import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { ContractTransactionResponse } from "ethers";
import type { Auditor, Market, MarketETHRouter, MockInterestRateModel, WETH } from "../../types";
import decodeMaturities from "./utils/decodeMaturities";
import timelockExecute from "./utils/timelockExecute";
import futurePools from "./utils/futurePools";

const { parseUnits, getUnnamedSigners, getNamedSigner, getContract, provider } = ethers;

describe("ETHMarket - receive bare ETH instead of WETH", function () {
  let irm: MockInterestRateModel;
  let weth: WETH;
  let auditor: Auditor;
  let routerETH: MarketETHRouter;
  let marketWETH: Market;

  let alice: SignerWithAddress;
  let pools: number[];

  before(async () => {
    [alice] = await getUnnamedSigners();
    pools = await futurePools(1);
  });

  beforeEach(async () => {
    await deployments.fixture("Markets");

    weth = await getContract<WETH>("WETH", alice);
    weth = await getContract<WETH>("WETH", alice);
    auditor = await getContract<Auditor>("Auditor", alice);
    routerETH = await getContract<MarketETHRouter>("MarketETHRouter", alice);
    marketWETH = await getContract<Market>("MarketWETH", alice);

    const owner = await getNamedSigner("multisig");
    await deployments.deploy("MockInterestRateModel", { args: [0], from: owner.address });
    irm = await getContract<MockInterestRateModel>("MockInterestRateModel", alice);
    await timelockExecute(owner, marketWETH, "setInterestRateModel", [irm.target]);
    // await timelockExecute(owner, marketWETH, "setPenaltyRate", [0]);

    await weth.approve(marketWETH.target, parseUnits("100"));
    await marketWETH.approve(routerETH.target, parseUnits("100"));
  });

  describe("depositToMaturityPoolETH vs depositToMaturityPool", () => {
    describe("WHEN depositing 5 ETH (bare ETH, not WETH) to a maturity pool", () => {
      let tx: ContractTransactionResponse;

      beforeEach(async () => {
        tx = await routerETH.depositAtMaturity(pools[0], parseUnits("5"), { value: parseUnits("5") });
      });

      it("THEN a DepositAtMaturity event is emitted", async () => {
        await expect(tx)
          .to.emit(marketWETH, "DepositAtMaturity")
          .withArgs(pools[0], routerETH.target, alice.address, parseUnits("5"), parseUnits("0"));
      });

      it("AND the ETHMarket contract has a balance of 5 WETH", async () => {
        expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("5"));
      });

      it("AND the ETHMarket registers a supply of 5 WETH for the account", async () => {
        const position = await marketWETH.fixedDepositPositions(pools[0], alice.address);
        expect(position[0]).to.be.equal(parseUnits("5"));
      });

      it("AND contract's state variable fixedDeposits registers the maturity where the account deposited to", async () => {
        const { fixedDeposits } = await marketWETH.accounts(alice.address);
        expect(decodeMaturities(fixedDeposits)).contains(pools[0]);
      });
    });

    describe("GIVEN alice has some WETH", () => {
      beforeEach(async () => {
        await weth.deposit({ value: parseUnits("10") });
      });

      describe("WHEN she deposits 5 WETH (ERC20) to a maturity pool", () => {
        let tx: ContractTransactionResponse;

        beforeEach(async () => {
          tx = await marketWETH.depositAtMaturity(pools[0], parseUnits("5"), parseUnits("5"), alice.address);
        });

        it("THEN a DepositToMaturityPool event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "DepositAtMaturity")
            .withArgs(pools[0], alice.address, alice.address, parseUnits("5"), parseUnits("0"));
        });

        it("AND the ETHMarket contract has a balance of 5 WETH", async () => {
          expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("5"));
        });

        it("AND the ETHMarket registers a supply of 5 WETH for the account", async () => {
          const position = await marketWETH.fixedDepositPositions(pools[0], alice.address);
          expect(position[0]).to.be.equal(parseUnits("5"));
        });

        it("AND contract's state variable fixedDeposits registers the maturity where the account deposited to", async () => {
          const { fixedDeposits } = await marketWETH.accounts(alice.address);
          expect(decodeMaturities(fixedDeposits)).contains(pools[0]);
        });
      });
    });
  });

  describe("depositToSmartPoolETH vs depositToSmartPool", () => {
    describe("WHEN alice deposits 5 ETH (bare ETH, not WETH) to a maturity pool", () => {
      let tx: ContractTransactionResponse;

      beforeEach(async () => {
        tx = await routerETH.deposit({ value: parseUnits("5") });
      });

      it("THEN a Deposit event is emitted", async () => {
        await expect(tx)
          .to.emit(marketWETH, "Deposit")
          .withArgs(routerETH.target, alice.address, parseUnits("5"), parseUnits("5"));
      });

      it("AND the ETHMarket contract has a balance of 5 WETH", async () => {
        expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("5"));
      });

      it("AND alice has a balance of 5 eWETH", async () => {
        expect(await marketWETH.balanceOf(alice.address)).to.be.equal(parseUnits("5"));
      });
    });

    describe("GIVEN alice has some WETH", () => {
      beforeEach(async () => {
        await weth.deposit({ value: parseUnits("10") });
      });

      describe("WHEN she deposits 5 WETH (ERC20) to the smart pool", () => {
        let tx: ContractTransactionResponse;

        beforeEach(async () => {
          tx = await marketWETH.deposit(parseUnits("5"), alice.address);
        });

        it("THEN a Deposit event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "Deposit")
            .withArgs(alice.address, alice.address, parseUnits("5"), parseUnits("5"));
        });

        it("AND the ETHMarket contract has a balance of 5 WETH", async () => {
          expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("5"));
        });

        it("AND alice has a balance of 5 eWETH", async () => {
          expect(await marketWETH.balanceOf(alice.address)).to.be.equal(parseUnits("5"));
        });
      });
    });
  });

  describe("withdrawFromSmartPoolETH vs withdrawFromSmartPool", () => {
    describe("GIVEN alice already has a 5 ETH SP deposit", () => {
      beforeEach(async () => {
        await weth.deposit({ value: parseUnits("10") });
        await marketWETH.deposit(parseUnits("5"), alice.address);
      });

      describe("WHEN withdrawing to 3 eWETH to ETH", () => {
        let tx: ContractTransactionResponse;
        let aliceETHBalanceBefore: bigint;

        beforeEach(async () => {
          aliceETHBalanceBefore = await provider.getBalance(alice.address);
          tx = await routerETH.withdraw(parseUnits("3"));
        });

        it("THEN a Withdraw event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "Withdraw")
            .withArgs(routerETH.target, routerETH.target, alice.address, parseUnits("3"), parseUnits("3"));
        });

        it("AND the ETHMarket contract has a balance of 2 WETH", async () => {
          expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("2"));
        });

        it("AND alice's ETH balance has increased by roughly 3", async () => {
          const newBalance = await provider.getBalance(alice.address);
          const balanceDiff = newBalance - aliceETHBalanceBefore;
          expect(balanceDiff).to.be.gt(parseUnits("2.95"));
          expect(balanceDiff).to.be.lt(parseUnits("3"));
        });
      });

      describe("WHEN redeeming 3 eWETH to ETH", () => {
        let tx: ContractTransactionResponse;
        let aliceETHBalanceBefore: bigint;

        beforeEach(async () => {
          aliceETHBalanceBefore = await provider.getBalance(alice.address);
          tx = await routerETH.redeem(parseUnits("3"));
        });

        it("THEN a Withdraw event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "Withdraw")
            .withArgs(routerETH.target, routerETH.target, alice.address, parseUnits("3"), parseUnits("3"));
        });

        it("AND the ETHMarket contract has a balance of 2 WETH", async () => {
          expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("2"));
        });

        it("AND alice's ETH balance has increased by roughly 3", async () => {
          const newBalance = await provider.getBalance(alice.address);
          const balanceDiff = newBalance - aliceETHBalanceBefore;
          expect(balanceDiff).to.be.gt(parseUnits("2.95"));
          expect(balanceDiff).to.be.lt(parseUnits("3"));
        });
      });

      describe("WHEN withdrawing 3 eWETH to WETH", () => {
        let tx: ContractTransactionResponse;

        beforeEach(async () => {
          tx = await marketWETH.withdraw(parseUnits("3"), alice.address, alice.address);
        });

        it("THEN a Withdraw event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "Withdraw")
            .withArgs(alice.address, alice.address, alice.address, parseUnits("3"), parseUnits("3"));
        });

        it("AND the ETHMarket contract has a balance of 2 WETH", async () => {
          expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("2"));
        });

        it("AND alice recovers her 2 ETH", async () => {
          expect(await weth.balanceOf(alice.address)).to.equal(parseUnits("8"));
        });
      });
    });
  });

  describe("withdrawFromMaturityPoolETH vs withdrawFromMaturityPool", () => {
    describe("GIVEN alice has a deposit to ETH maturity AND maturity is reached", () => {
      beforeEach(async () => {
        await weth.deposit({ value: parseUnits("10") });
        await marketWETH.depositAtMaturity(pools[0], parseUnits("10"), parseUnits("10"), alice.address);
        await provider.send("evm_setNextBlockTimestamp", [pools[0]]);
      });

      describe("WHEN she withdraws to ETH", () => {
        let tx: ContractTransactionResponse;
        let aliceETHBalanceBefore: bigint;

        beforeEach(async () => {
          aliceETHBalanceBefore = await provider.getBalance(alice.address);
          tx = await routerETH.withdrawAtMaturity(pools[0], parseUnits("10"), 0);
        });

        it("THEN a WithdrawFromMaturityPool event is emmitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "WithdrawAtMaturity")
            .withArgs(pools[0], routerETH.target, routerETH.target, alice.address, parseUnits("10"), parseUnits("10"));
        });

        it("AND alices ETH balance increases accordingly", async () => {
          const newBalance = await provider.getBalance(alice.address);
          const balanceDiff = newBalance - aliceETHBalanceBefore;
          expect(balanceDiff).to.be.gt(parseUnits("9.95"));
          expect(balanceDiff).to.be.lt(parseUnits("10"));
        });

        it("AND the ETHMarket contracts WETH balance decreased accordingly", async () => {
          expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("0"));
        });

        it("AND contract's state variable fixedDeposits registers the maturity where the account deposited to", async () => {
          const { fixedDeposits } = await marketWETH.accounts(alice.address);
          expect(decodeMaturities(fixedDeposits).length).equal(0);
        });
      });

      describe("WHEN she withdraws to WETH", () => {
        let tx: ContractTransactionResponse;

        beforeEach(async () => {
          tx = await marketWETH.withdrawAtMaturity(pools[0], parseUnits("10"), 0, alice.address, alice.address);
        });

        it("THEN a WithdrawFromMaturityPool event is emmitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "WithdrawAtMaturity")
            .withArgs(pools[0], alice.address, alice.address, alice.address, parseUnits("10"), parseUnits("10"));
        });

        it("AND alices WETH balance increases accordingly", async () => {
          expect(await weth.balanceOf(alice.address)).to.equal(parseUnits("10"));
        });

        it("AND the ETHMarket contracts WETH balance decreased accordingly", async () => {
          expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("0"));
        });
      });
    });
  });

  describe("borrowFromMaturityPoolETH vs borrowFromMaturityPool", () => {
    describe("GIVEN alice has some WETH collateral", () => {
      beforeEach(async () => {
        await weth.deposit({ value: parseUnits("60") });
        await marketWETH.deposit(parseUnits("60"), alice.address);
        await auditor.enterMarket(marketWETH.target);
        await provider.send("evm_increaseTime", [9_011]);
      });

      describe("WHEN borrowing with ETH (native)", () => {
        let tx: ContractTransactionResponse;

        beforeEach(async () => {
          tx = await routerETH.borrowAtMaturity(pools[0], parseUnits("5"), parseUnits("6"));
        });

        it("THEN a BorrowFromMaturityPool event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "BorrowAtMaturity")
            .withArgs(pools[0], routerETH.target, routerETH.target, alice.address, parseUnits("5"), 0);
        });

        it("AND a 5 WETH borrow is registered", async () => {
          expect((await marketWETH.fixedPools(pools[0]))[0]).to.equal(parseUnits("5"));
        });

        it("AND contract's state variable fixedBorrows registers the maturity where the account borrowed from", async () => {
          const { fixedBorrows } = await marketWETH.accounts(alice.address);
          expect(decodeMaturities(fixedBorrows)).contains(pools[0]);
        });
      });

      describe("WHEN borrowing with WETH (erc20)", () => {
        let tx: ContractTransactionResponse;

        beforeEach(async () => {
          tx = await marketWETH.borrowAtMaturity(
            pools[0],
            parseUnits("5"),
            parseUnits("6"),
            alice.address,
            alice.address,
          );
        });

        it("THEN a BorrowFromMaturityPool event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "BorrowAtMaturity")
            .withArgs(pools[0], alice.address, alice.address, alice.address, parseUnits("5"), 0);
        });

        it("AND a 5 WETH borrow is registered", async () => {
          expect((await marketWETH.fixedPools(pools[0]))[0]).to.equal(parseUnits("5"));
        });

        it("AND contract's state variable fixedBorrows registers the maturity where the account borrowed from", async () => {
          const { fixedBorrows } = await marketWETH.accounts(alice.address);
          expect(decodeMaturities(fixedBorrows)).contains(pools[0]);
        });
      });

      describe("repayToMaturityPoolETH vs repayToMaturityPool", () => {
        describe("AND she borrows some WETH (erc20) AND maturity is reached", () => {
          beforeEach(async () => {
            await marketWETH.borrowAtMaturity(pools[0], parseUnits("5"), parseUnits("6"), alice.address, alice.address);
            await provider.send("evm_setNextBlockTimestamp", [pools[0]]);
          });

          describe("WHEN repaying in WETH (erc20)", () => {
            let tx: ContractTransactionResponse;

            beforeEach(async () => {
              tx = await marketWETH.repayAtMaturity(pools[0], parseUnits("5"), parseUnits("6"), alice.address);
            });

            it("THEN a RepayToMaturityPool event is emitted", async () => {
              await expect(tx)
                .to.emit(marketWETH, "RepayAtMaturity")
                .withArgs(pools[0], alice.address, alice.address, parseUnits("5"), parseUnits("5"));
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND WETH is returned to the contract", async () => {
              expect(await weth.balanceOf(alice.address)).to.equal(parseUnits("0"));
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
            });
          });
        });

        describe("AND she borrows some ETH (native) AND maturity is reached", () => {
          beforeEach(async () => {
            await routerETH.borrowAtMaturity(pools[0], parseUnits("5"), parseUnits("6"));
            await provider.send("evm_setNextBlockTimestamp", [pools[0]]);
          });

          describe("WHEN repaying in ETH (native)", () => {
            let tx: ContractTransactionResponse;
            let aliceETHBalanceBefore: bigint;

            beforeEach(async () => {
              aliceETHBalanceBefore = await provider.getBalance(alice.address);
              tx = await routerETH.repayAtMaturity(pools[0], parseUnits("5"), { value: parseUnits("5") });
            });

            it("THEN a RepayToMaturityPool event is emitted", async () => {
              await expect(tx)
                .to.emit(marketWETH, "RepayAtMaturity")
                .withArgs(pools[0], routerETH.target, alice.address, parseUnits("5"), parseUnits("5"));
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND ETH is returned to the contract", async () => {
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
              const newBalance = await provider.getBalance(alice.address);
              const balanceDiff = aliceETHBalanceBefore - newBalance;
              expect(balanceDiff).to.be.lt(parseUnits("5.05"));
              expect(balanceDiff).to.be.gt(parseUnits("5"));
            });
          });

          describe("WHEN repaying more than debt amount in ETH (native)", () => {
            let aliceETHBalanceBefore: bigint;

            beforeEach(async () => {
              aliceETHBalanceBefore = await provider.getBalance(alice.address);
              await routerETH.repayAtMaturity(pools[0], parseUnits("10"), { value: parseUnits("10") });
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND ETH is returned to the contract", async () => {
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
              const newBalance = await provider.getBalance(alice.address);
              const balanceDiff = aliceETHBalanceBefore - newBalance;
              expect(balanceDiff).to.be.lt(parseUnits("5.05"));
              expect(balanceDiff).to.be.gt(parseUnits("5"));
            });
          });
        });
      });
    });
  });

  describe("flexibleBorrowETH vs flexibleBorrow", () => {
    describe("GIVEN alice has some WETH collateral", () => {
      beforeEach(async () => {
        await weth.deposit({ value: parseUnits("60") });
        await marketWETH.deposit(parseUnits("60"), alice.address);
        await auditor.enterMarket(marketWETH.target);
      });

      describe("WHEN borrowing with ETH (native)", () => {
        let tx: ContractTransactionResponse;

        beforeEach(async () => {
          tx = await routerETH.borrow(parseUnits("5"));
        });

        it("THEN a Borrow event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "Borrow")
            .withArgs(routerETH.target, routerETH.target, alice.address, parseUnits("5"), parseUnits("5"));
        });

        it("AND a 5 WETH borrow is registered", async () => {
          const { floatingBorrowShares } = await marketWETH.accounts(alice.address);
          expect(floatingBorrowShares).to.equal(parseUnits("5"));
        });
      });

      describe("WHEN borrowing with WETH (erc20)", () => {
        let tx: ContractTransactionResponse;

        beforeEach(async () => {
          tx = await marketWETH.borrow(parseUnits("5"), alice.address, alice.address);
        });

        it("THEN a Borrow event is emitted", async () => {
          await expect(tx)
            .to.emit(marketWETH, "Borrow")
            .withArgs(alice.address, alice.address, alice.address, parseUnits("5"), parseUnits("5"));
        });

        it("AND a 5 WETH borrow is registered", async () => {
          const { floatingBorrowShares } = await marketWETH.accounts(alice.address);
          expect(floatingBorrowShares).to.equal(parseUnits("5"));
        });
      });

      describe("flexibleRepayETH vs flexibleRepay", () => {
        describe("AND she borrows some WETH (erc20) AND maturity is reached", () => {
          beforeEach(async () => {
            await marketWETH.borrow(parseUnits("5"), alice.address, alice.address);
          });

          describe("WHEN refunding in WETH (erc20)", () => {
            let tx: ContractTransactionResponse;

            beforeEach(async () => {
              tx = await marketWETH.refund(parseUnits("5"), alice.address);
            });

            it("THEN a Repay event is emitted", async () => {
              await expect(tx)
                .to.emit(marketWETH, "Repay")
                .withArgs(alice.address, alice.address, parseUnits("5"), parseUnits("5"));
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND WETH is returned to the contract", async () => {
              expect(await weth.balanceOf(alice.address)).to.equal(parseUnits("0"));
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
            });
          });

          describe("WHEN repaying in WETH (erc20)", () => {
            let tx: ContractTransactionResponse;

            beforeEach(async () => {
              tx = await marketWETH.repay(parseUnits("5"), alice.address);
            });

            it("THEN a Repay event is emitted", async () => {
              await expect(tx)
                .to.emit(marketWETH, "Repay")
                .withArgs(alice.address, alice.address, parseUnits("5"), parseUnits("5"));
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND WETH is returned to the contract", async () => {
              expect(await weth.balanceOf(alice.address)).to.equal(parseUnits("0"));
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
            });
          });
        });

        describe("AND she borrows some ETH (native) AND maturity is reached", () => {
          beforeEach(async () => {
            await routerETH.borrow(parseUnits("5"));
          });

          describe("WHEN refunding in ETH (native)", () => {
            let tx: ContractTransactionResponse;
            let aliceETHBalanceBefore: bigint;

            beforeEach(async () => {
              aliceETHBalanceBefore = await provider.getBalance(alice.address);
              tx = await routerETH.refund(parseUnits("5"), { value: parseUnits("5") });
            });

            it("THEN a Repay event is emitted", async () => {
              await expect(tx)
                .to.emit(marketWETH, "Repay")
                .withArgs(routerETH.target, alice.address, parseUnits("5"), parseUnits("5"));
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND ETH is returned to the contract", async () => {
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
              const newBalance = await provider.getBalance(alice.address);
              const balanceDiff = aliceETHBalanceBefore - newBalance;
              expect(balanceDiff).to.be.gt(parseUnits("5"));
              expect(balanceDiff).to.be.lt(parseUnits("5.001"));
            });
          });

          describe("WHEN repaying in ETH (native)", () => {
            let tx: ContractTransactionResponse;
            let aliceETHBalanceBefore: bigint;

            beforeEach(async () => {
              aliceETHBalanceBefore = await provider.getBalance(alice.address);
              tx = await routerETH.repay(parseUnits("5"), { value: parseUnits("5") });
            });

            it("THEN a Repay event is emitted", async () => {
              await expect(tx)
                .to.emit(marketWETH, "Repay")
                .withArgs(routerETH.target, alice.address, parseUnits("5"), parseUnits("5"));
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND ETH is returned to the contract", async () => {
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
              const newBalance = await provider.getBalance(alice.address);
              const balanceDiff = aliceETHBalanceBefore - newBalance;
              expect(balanceDiff).to.be.gt(parseUnits("5"));
              expect(balanceDiff).to.be.lt(parseUnits("5.001"));
            });
          });

          describe("WHEN refunding more than debt amount in ETH (native)", () => {
            let aliceETHBalanceBefore: bigint;

            beforeEach(async () => {
              aliceETHBalanceBefore = await provider.getBalance(alice.address);
              await routerETH.refund(parseUnits("10"), { value: parseUnits("10") });
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND ETH is returned to the contract", async () => {
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
              const newBalance = await provider.getBalance(alice.address);
              const balanceDiff = aliceETHBalanceBefore - newBalance;
              expect(balanceDiff).to.be.gt(parseUnits("5"));
              expect(balanceDiff).to.be.lt(parseUnits("5.001"));
            });
          });

          describe("WHEN repaying more than debt amount in ETH (native)", () => {
            let aliceETHBalanceBefore: bigint;

            beforeEach(async () => {
              aliceETHBalanceBefore = await provider.getBalance(alice.address);
              await routerETH.repay(parseUnits("10"), { value: parseUnits("10") });
            });

            it("AND Alice's debt is cleared", async () => {
              const amountOwed = await marketWETH.previewDebt(alice.address);
              expect(amountOwed).to.equal(parseUnits("0"));
            });

            it("AND ETH is returned to the contract", async () => {
              expect(await weth.balanceOf(marketWETH.target)).to.equal(parseUnits("60"));
              const newBalance = await provider.getBalance(alice.address);
              const balanceDiff = aliceETHBalanceBefore - newBalance;
              expect(balanceDiff).to.be.gt(parseUnits("5"));
              expect(balanceDiff).to.be.lt(parseUnits("5.001"));
            });
          });
        });
      });
    });
  });

  describe("GIVEN alice mistakenly transfers ETH to the router contract", () => {
    it("THEN it reverts with NotFromWETH error", async () => {
      await expect(
        alice.sendTransaction({
          to: routerETH.target,
          value: parseUnits("1"),
        }),
      ).to.be.revertedWithCustomError(routerETH, "NotFromWETH");
    });
  });

  describe("slippage control", () => {
    let tx: Promise<ContractTransactionResponse>;

    beforeEach(async () => {
      await irm.setRate(parseUnits("0.05"));
    });

    describe("WHEN trying to deposit a high rate amount expected", () => {
      beforeEach(async () => {
        tx = routerETH.depositAtMaturity(pools[0], parseUnits("10"), { value: parseUnits("5") });
      });

      it("THEN the tx should revert with Disagreement", async () => {
        await expect(tx).to.be.revertedWithCustomError(marketWETH, "Disagreement");
      });
    });

    describe("WHEN trying to borrow with a low rate amount expected", () => {
      beforeEach(async () => {
        await weth.deposit({ value: parseUnits("60") });
        await marketWETH.deposit(parseUnits("60"), alice.address);
        await auditor.enterMarket(marketWETH.target);
        await provider.send("evm_increaseTime", [9_011]);
        tx = routerETH.borrowAtMaturity(pools[0], parseUnits("5"), parseUnits("5"));
      });

      it("THEN the tx should revert with Disagreement", async () => {
        await expect(tx).to.be.revertedWithCustomError(marketWETH, "Disagreement");
      });
    });

    describe("WHEN trying to withdraw with a high rate amount expected", () => {
      beforeEach(async () => {
        await routerETH.depositAtMaturity(pools[0], parseUnits("5"), { value: parseUnits("5") });
        tx = routerETH.withdrawAtMaturity(pools[0], parseUnits("5"), parseUnits("10"));
      });

      it("THEN the tx should revert with Disagreement", async () => {
        await expect(tx).to.be.revertedWithCustomError(marketWETH, "Disagreement");
      });
    });

    describe("WHEN trying to repay with a low rate amount expected", () => {
      beforeEach(async () => {
        await weth.deposit({ value: parseUnits("60") });
        await marketWETH.deposit(parseUnits("60"), alice.address);
        await auditor.enterMarket(marketWETH.target);
        await provider.send("evm_increaseTime", [9_011]);
        await routerETH.borrowAtMaturity(pools[0], parseUnits("5"), parseUnits("10"));
        tx = routerETH.repayAtMaturity(pools[0], parseUnits("5"), { value: parseUnits("4") });
      });

      it("THEN the tx should revert with Disagreement", async () => {
        await expect(tx).to.be.revertedWithCustomError(marketWETH, "Disagreement");
      });
    });
  });
});
