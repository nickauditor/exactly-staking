import { expect } from "chai";
import { ethers } from "hardhat";
import { PoolEnv } from "./poolEnv";
import { INTERVAL } from "./utils/futurePools";

const { parseUnits, provider } = ethers;

describe("Fixed Pool Management Library", () => {
  let poolEnv: PoolEnv;
  let fp: {
    borrowed: bigint;
    supplied: bigint;
    unassignedEarnings: bigint;
    lastAccrual: bigint;
  };
  let scaledDebt: { principal: bigint; fee: bigint };

  describe("GIVEN a clean fixed rate pool", () => {
    beforeEach(async () => {
      poolEnv = await PoolEnv.create();
    });

    describe("deposit & borrow", () => {
      describe("WHEN 100 assets are deposited", () => {
        beforeEach(async () => {
          await poolEnv.deposit("100");
          fp = await poolEnv.fpHarness.fixedPool();
        });

        it("THEN the pool 'borrowed' is 0", async () => {
          expect(fp.borrowed).to.equal(parseUnits("0"));
        });

        it("THEN the pool 'supplied' is 100", async () => {
          expect(fp.supplied).to.equal(parseUnits("100"));
        });

        it("THEN the pool 'unassignedEarnings' are 0", async () => {
          expect(fp.unassignedEarnings).to.equal(parseUnits("0"));
        });

        it("THEN the backupDebtReduction that is returned is 0", async () => {
          const backupDebtReductionReturned = await poolEnv.getFpHarness().backupDebtReduction();
          expect(backupDebtReductionReturned).to.equal(parseUnits("0"));
        });

        describe("AND WHEN 80 assets are taken out", () => {
          beforeEach(async () => {
            await poolEnv.borrow("80");
            fp = await poolEnv.fpHarness.fixedPool();
          });

          it("THEN the backupDebtAddition that is returned is 0", async () => {
            const newDebtSpReturned = await poolEnv.getFpHarness().backupDebtAddition();
            expect(newDebtSpReturned).to.equal(parseUnits("0"));
          });

          it("THEN the pool 'borrowed' is 80", async () => {
            expect(fp.borrowed).to.equal(parseUnits("80"));
          });

          it("THEN the pool 'supplied' is 100", async () => {
            expect(fp.supplied).to.equal(parseUnits("100"));
          });

          describe("AND WHEN another 20 assets are taken out", () => {
            beforeEach(async () => {
              await poolEnv.borrow("20");
              fp = await poolEnv.fpHarness.fixedPool();
            });

            it("THEN the backupDebtAddition that is returned is 0", async () => {
              const newDebtSpReturned = await poolEnv.getFpHarness().backupDebtAddition();
              expect(newDebtSpReturned).to.equal(parseUnits("0"));
            });

            it("THEN the pool 'borrowed' is 100", async () => {
              expect(fp.borrowed).to.equal(parseUnits("100"));
            });

            it("THEN the pool 'supplied' is 100", async () => {
              expect(fp.supplied).to.equal(parseUnits("100"));
            });

            describe("AND WHEN 50 assets are taken out", () => {
              beforeEach(async () => {
                await poolEnv.borrow("50");
                fp = await poolEnv.fpHarness.fixedPool();
              });

              it("THEN the backupDebtAddition that is returned is 0", async () => {
                const newDebtSpReturned = await poolEnv.getFpHarness().backupDebtAddition();
                expect(newDebtSpReturned).to.equal(parseUnits("50"));
              });

              it("THEN the pool 'borrowed' is 150", async () => {
                expect(fp.borrowed).to.equal(parseUnits("150"));
              });

              it("THEN the pool 'supplied' is 100", async () => {
                expect(fp.supplied).to.equal(parseUnits("100"));
              });
            });
          });
        });

        describe("AND WHEN 180 assets are taken out", () => {
          beforeEach(async () => {
            await poolEnv.borrow("180");
            fp = await poolEnv.fpHarness.fixedPool();
          });

          it("THEN the backupDebtAddition that is returned is 80", async () => {
            const newDebtSpReturned = await poolEnv.getFpHarness().backupDebtAddition();
            expect(newDebtSpReturned).to.equal(parseUnits("80"));
          });

          it("THEN the pool 'borrowed' is 180", async () => {
            expect(fp.borrowed).to.equal(parseUnits("180"));
          });

          it("THEN the pool 'supplied' is 100", async () => {
            expect(fp.supplied).to.equal(parseUnits("100"));
          });

          describe("AND WHEN 90 assets are deposited", () => {
            beforeEach(async () => {
              await poolEnv.deposit("90");
              fp = await poolEnv.fpHarness.fixedPool();
            });

            it("THEN the backupDebtReduction that is returned is 80", async () => {
              const backupDebtReduction = await poolEnv.getFpHarness().backupDebtReduction();
              expect(backupDebtReduction).to.equal(parseUnits("80"));
            });

            it("THEN the pool 'borrowed' is 180", async () => {
              expect(fp.borrowed).to.equal(parseUnits("180"));
            });

            it("THEN the pool 'supplied' is 190", async () => {
              expect(fp.supplied).to.equal(parseUnits("190"));
            });

            describe("AND WHEN 100 assets are deposited", () => {
              beforeEach(async () => {
                await poolEnv.deposit("100");
                fp = await poolEnv.fpHarness.fixedPool();
              });

              it("THEN the backupDebtReduction that is 0", async () => {
                const backupDebtReduction = await poolEnv.getFpHarness().backupDebtReduction();
                expect(backupDebtReduction).to.equal(parseUnits("0"));
              });

              it("THEN the pool 'borrowed' is 180", async () => {
                expect(fp.borrowed).to.equal(parseUnits("180"));
              });

              it("THEN the pool 'supplied' is 290", async () => {
                expect(fp.supplied).to.equal(parseUnits("290"));
              });
            });
          });
        });
      });
    });

    describe("calculateDeposit without a backupFeeRate (0%)", () => {
      it("WHEN backupSupplied is 100, unassignedEarnings are 100, and amount deposited is 100, THEN earnings is 100 (0 for the SP)", async () => {
        const result = await poolEnv.calculateDeposit("100", "100", "100", "0");

        expect(result[0]).to.equal(parseUnits("100"));
        expect(result[1]).to.equal(parseUnits("0"));
      });

      it("WHEN backupSupplied is 101, unassignedEarnings are 100, and amount deposited is 100, THEN earnings is 99.0099... (0 for the SP)", async () => {
        const result = await poolEnv.calculateDeposit("100", "100", "101", "0");

        expect(result[0]).to.closeTo(parseUnits("99.00990099"), Number(parseUnits("00.00000001")));
        expect(result[1]).to.eq(parseUnits("0"));
      });

      it("WHEN backupSupplied is 200, unassignedEarnings are 100, and amount deposited is 100, THEN earnings is 50 (0 for the SP)", async () => {
        const result = await poolEnv.calculateDeposit("100", "100", "200", "0");

        expect(result[0]).to.equal(parseUnits("50"));
        expect(result[1]).to.equal(parseUnits("0"));
      });

      it("WHEN backupSupplied is 0, unassignedEarnings are 100, and amount deposited is 100, THEN earnings is 0 (0 for the SP)", async () => {
        const result = await poolEnv.calculateDeposit("100", "100", "0", "0");

        expect(result[0]).to.equal(parseUnits("0"));
        expect(result[1]).to.equal(parseUnits("0"));
      });

      it("WHEN backupSupplied is 100, unassignedEarnings are 0, and amount deposited is 100, THEN earnings is 0 (0 for the SP)", async () => {
        const result = await poolEnv.calculateDeposit("0", "0", "100", "0");

        expect(result[0]).to.equal(parseUnits("0"));
        expect(result[1]).to.equal(parseUnits("0"));
      });

      it("WHEN backupSupplied is 100, unassignedEarnings are 100, and amount deposited is 0, THEN earnings is 0 (0 for the SP)", async () => {
        const result = await poolEnv.calculateDeposit("0", "100", "100", "0");

        expect(result[0]).to.equal(parseUnits("0"));
        expect(result[1]).to.equal(parseUnits("0"));
      });
    });

    describe("getYieldForDeposit with a custom backupFeeRate, backupSupplied of 100, unassignedEarnings of 100 and amount deposited of 100", () => {
      it("WHEN backupFeeRate is 20%, THEN earnings is 80 (20 for the SP)", async () => {
        const result = await poolEnv.calculateDeposit("100", "100", "100", "0.2");

        expect(result[0]).to.eq(parseUnits("80"));
        expect(result[1]).to.eq(parseUnits("20"));
      });

      it("WHEN backupFeeRate is 20% AND backupSupplied is 101 THEN earnings is 79.2079... (19.8019... for the SP)", async () => {
        const result = await poolEnv.calculateDeposit("100", "100", "101", "0.2");

        expect(result[0]).to.closeTo(parseUnits("79.20792079"), Number(parseUnits("00.00000001")));
        expect(result[1]).to.closeTo(parseUnits("19.80198019"), Number(parseUnits("00.00000001")));
      });
    });

    describe("addFee & removeFee", () => {
      describe("WHEN 100 fees are added", () => {
        beforeEach(async () => {
          await poolEnv.addFee("100");
          fp = await poolEnv.fpHarness.fixedPool();
        });

        it("THEN the pool 'unassignedEarnings' are 100", async () => {
          expect(fp.unassignedEarnings).to.equal(parseUnits("100"));
        });

        describe("AND WHEN 50 fees are removed", () => {
          beforeEach(async () => {
            await poolEnv.removeFee("50");
            fp = await poolEnv.fpHarness.fixedPool();
          });

          it("THEN the pool 'unassignedEarnings' are 50", async () => {
            expect(fp.unassignedEarnings).to.equal(parseUnits("50"));
          });

          describe("AND WHEN another 50 fees are removed", () => {
            beforeEach(async () => {
              await poolEnv.removeFee("50");
              fp = await poolEnv.fpHarness.fixedPool();
            });

            it("THEN the pool 'unassignedEarnings' are 0", async () => {
              expect(fp.unassignedEarnings).to.equal(parseUnits("0"));
            });
          });
        });
      });
    });

    describe("accrueEarnings", () => {
      describe("GIVEN a fresh fixed rate pool (maturity date in 10 days)", () => {
        let now: number;
        let sixDays: number;
        let tenDays: number;
        let snapshot: string;

        beforeEach(async () => {
          snapshot = await provider.send("evm_snapshot", []);
          now = Math.floor(Date.now() / 1000) + 6_666_666;
          tenDays = now + 86_400 * 10;
          sixDays = now + 86_400 * 6;

          await provider.send("evm_setNextBlockTimestamp", [now]);
          await poolEnv.accrueEarnings(tenDays);
          fp = await poolEnv.fpHarness.fixedPool();
        });

        afterEach(() => provider.send("evm_revert", [snapshot]));

        it("THEN the pool 'unassignedEarnings' are 0", async () => {
          expect(fp.unassignedEarnings).to.equal(0);
        });

        it("THEN the pool 'lastAccrual' is now", async () => {
          expect(fp.lastAccrual).to.equal(now);
        });

        it("THEN the last earnings SP is 0", async () => {
          const lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
          expect(lastBackupEarnings).to.equal(0);
        });

        describe("AND GIVEN 100 are added in fees and 6 days went by", () => {
          beforeEach(async () => {
            await poolEnv.addFee("100");
            await provider.send("evm_setNextBlockTimestamp", [sixDays]);
            await poolEnv.accrueEarnings(tenDays);
            fp = await poolEnv.fpHarness.fixedPool();
          });

          it("THEN the pool 'unassignedEarnings' are 40", async () => {
            expect(fp.unassignedEarnings).to.equal(parseUnits("40"));
          });

          it("THEN the pool 'lastAccrual' is fiveDays", async () => {
            expect(fp.lastAccrual).to.equal(sixDays);
          });

          it("THEN the last earnings SP is 60", async () => {
            const lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
            expect(lastBackupEarnings).to.equal(parseUnits("60"));
          });

          describe("AND GIVEN that another 150 seconds go by", () => {
            beforeEach(async () => {
              await provider.send("evm_setNextBlockTimestamp", [sixDays + 150]);
              await poolEnv.accrueEarnings(tenDays);
              fp = await poolEnv.fpHarness.fixedPool();
            });

            it("THEN the pool 'unassignedEarnings' are ~= 39.98263", async () => {
              // 10 / 86400           = 0.00011574074 (unassigned earnings per second)
              // 0.00011574074 * 150  = 0.01736111111 (earnings accrued)
              // 40 - 0.01736111111   = 39.9826388889 (unassigned earnings left)
              expect(fp.unassignedEarnings).to.closeTo(parseUnits("39.9826388"), Number(parseUnits("00.0000001")));
            });

            it("THEN the pool 'lastAccrual' is tenDays", async () => {
              expect(fp.lastAccrual).to.equal(sixDays + 150);
            });

            it("THEN the last earnings SP is ~= 0.017361", async () => {
              const lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
              expect(lastBackupEarnings).to.closeTo(parseUnits("0.0173611"), Number(parseUnits("0.0000001")));
            });
          });

          describe("AND GIVEN that +1 day goes over the maturity date", () => {
            beforeEach(async () => {
              await provider.send("evm_setNextBlockTimestamp", [tenDays + 86_400]);
              await poolEnv.accrueEarnings(tenDays);
              fp = await poolEnv.fpHarness.fixedPool();
            });

            it("THEN the pool 'unassignedEarnings' are 0", async () => {
              expect(fp.unassignedEarnings).to.equal(0);
            });

            it("THEN the pool 'lastAccrual' is tenDays", async () => {
              expect(fp.lastAccrual).to.equal(tenDays);
            });

            it("THEN the last earnings SP is 40 (the remaining)", async () => {
              const lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
              expect(lastBackupEarnings).to.equal(parseUnits("40"));
            });

            describe("AND GIVEN that another +1 day goes over the maturity date", () => {
              beforeEach(async () => {
                await provider.send("evm_setNextBlockTimestamp", [tenDays + 86_400 * 2]);
                await poolEnv.accrueEarnings(tenDays);
                fp = await poolEnv.fpHarness.fixedPool();
              });

              it("THEN the pool 'unassignedEarnings' are 0", async () => {
                expect(fp.unassignedEarnings).to.equal(0);
              });

              it("THEN the pool 'lastAccrual' is tenDays", async () => {
                expect(fp.lastAccrual).to.equal(tenDays);
              });

              it("THEN the last earnings SP is 0", async () => {
                const lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
                expect(lastBackupEarnings).to.equal(parseUnits("0"));
              });
            });
          });

          describe("AND GIVEN that 20 fees are removed and +1 day goes over the maturity date", () => {
            beforeEach(async () => {
              await poolEnv.removeFee("20");
              await provider.send("evm_setNextBlockTimestamp", [tenDays + 86_400]);
              await poolEnv.accrueEarnings(tenDays);
              fp = await poolEnv.fpHarness.fixedPool();
            });

            it("THEN the pool 'unassignedEarnings' are 0", async () => {
              expect(fp.unassignedEarnings).to.equal(0);
            });

            it("THEN the pool 'lastAccrual' is tenDays", async () => {
              expect(fp.lastAccrual).to.equal(tenDays);
            });

            it("THEN the last earnings SP is 20 (40 were remaining - 20 removed)", async () => {
              const lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
              expect(lastBackupEarnings).to.equal(parseUnits("20"));
            });
          });
        });
      });
    });

    describe("repay", () => {
      describe("WHEN 100 assets are taken out", () => {
        beforeEach(async () => {
          await poolEnv.borrow("100");
          fp = await poolEnv.fpHarness.fixedPool();
        });

        it("THEN the pool 'borrowed' is 100", async () => {
          expect(fp.borrowed).to.equal(parseUnits("100"));
        });

        it("THEN the backupDebtAddition that is returned is 100", async () => {
          const newDebtSpReturned = await poolEnv.getFpHarness().backupDebtAddition();
          expect(newDebtSpReturned).to.equal(parseUnits("100"));
        });

        describe("AND WHEN 50 assets are repaid", () => {
          beforeEach(async () => {
            await poolEnv.repay("50");
            fp = await poolEnv.fpHarness.fixedPool();
          });

          it("THEN the pool 'borrowed' is 50", async () => {
            expect(fp.borrowed).to.equal(parseUnits("50"));
          });

          it("THEN the pool 'supplied' is 0", async () => {
            expect(fp.supplied).to.equal(parseUnits("0"));
          });

          it("THEN the backupDebtReduction that is returned is 50", async () => {
            const backupDebtReductionReturned = await poolEnv.getFpHarness().backupDebtReduction();
            expect(backupDebtReductionReturned).to.equal(parseUnits("50"));
          });

          describe("AND WHEN another 50 assets are repaid", () => {
            beforeEach(async () => {
              await poolEnv.repay("50");
              fp = await poolEnv.fpHarness.fixedPool();
            });

            it("THEN the pool 'borrowed' is 0", async () => {
              expect(fp.borrowed).to.equal(parseUnits("0"));
            });

            it("THEN the backupDebtReduction that is returned is 50", async () => {
              const backupDebtReductionReturned = await poolEnv.getFpHarness().backupDebtReduction();
              expect(backupDebtReductionReturned).to.equal(parseUnits("50"));
            });
          });
        });
      });
    });

    describe("withdraw", () => {
      describe("GIVEN 100 assets are deposited", () => {
        beforeEach(async () => {
          await poolEnv.deposit("100");
        });

        describe("WHEN 50 assets are withdrawn", () => {
          beforeEach(async () => {
            await poolEnv.withdraw("50");
            fp = await poolEnv.fpHarness.fixedPool();
          });

          it("THEN the pool 'supplied' is 50", async () => {
            expect(fp.supplied).to.equal(parseUnits("50"));
          });

          it("THEN the backupDebtAddition that is returned is 0", async () => {
            const newDebtSpReturned = await poolEnv.getFpHarness().backupDebtAddition();
            expect(newDebtSpReturned).to.equal(parseUnits("0"));
          });

          describe("AND GIVEN another 100 assets are taken out", () => {
            beforeEach(async () => {
              await poolEnv.borrow("100");
            });

            describe("WHEN another 50 assets are withdrawn", () => {
              beforeEach(async () => {
                await poolEnv.withdraw("50");
                fp = await poolEnv.fpHarness.fixedPool();
              });

              it("THEN the pool 'supplied' is 0", async () => {
                expect(fp.supplied).to.equal(parseUnits("0"));
              });

              it("THEN the backupDebtAddition that is returned is 50", async () => {
                const newDebtSpReturned = await poolEnv.getFpHarness().backupDebtAddition();
                expect(newDebtSpReturned).to.equal(parseUnits("50"));
              });
            });
          });

          describe("AND WHEN another 50 assets are withdrawn", () => {
            beforeEach(async () => {
              await poolEnv.withdraw("50");
              fp = await poolEnv.fpHarness.fixedPool();
            });

            it("THEN the pool 'supplied' is 0", async () => {
              expect(fp.supplied).to.equal(parseUnits("0"));
            });

            it("THEN the backupDebtAddition that is returned is 0", async () => {
              const newDebtSpReturned = await poolEnv.getFpHarness().backupDebtAddition();
              expect(newDebtSpReturned).to.equal(parseUnits("0"));
            });
          });
        });
      });
    });

    describe("scaleProportionally", () => {
      describe("GIVEN a 100 scaledDebtPrincipal AND a 100 scaledDebtFee", () => {
        describe("WHEN 50 is proportionally scaled", () => {
          beforeEach(async () => {
            await poolEnv.scaleProportionally("100", "100", "50");
            scaledDebt = await poolEnv.getFpHarness().scaledDebt();
          });

          it("THEN the scaledDebtPrincipal is 25", async () => {
            expect(scaledDebt.principal).to.equal(parseUnits("25"));
          });

          it("THEN the scaledDebtFee is 25", async () => {
            expect(scaledDebt.fee).to.equal(parseUnits("25"));
          });

          describe("AND WHEN another 5 is proportionally scaled", () => {
            beforeEach(async () => {
              await poolEnv.scaleProportionally("25", "25", "5");
              scaledDebt = await poolEnv.getFpHarness().scaledDebt();
            });

            it("THEN the scaledDebtPrincipal is 2.5", async () => {
              expect(scaledDebt.principal).to.equal(parseUnits("2.5"));
            });

            it("THEN the scaledDebtFee is 2.5", async () => {
              expect(scaledDebt.fee).to.equal(parseUnits("2.5"));
            });
          });
        });
      });

      describe("GIVEN a 100 scaledDebtPrincipal AND a 0 scaledDebtFee", () => {
        describe("WHEN 50 is proportionally scaled", () => {
          beforeEach(async () => {
            await poolEnv.scaleProportionally("100", "0", "50");
            scaledDebt = await poolEnv.getFpHarness().scaledDebt();
          });

          it("THEN the scaledDebtPrincipal is 50", async () => {
            expect(scaledDebt.principal).to.equal(parseUnits("50"));
          });

          it("THEN the scaledDebtFee is 0", async () => {
            expect(scaledDebt.fee).to.equal(parseUnits("0"));
          });
        });
      });

      describe("GIVEN a 0 scaledDebtPrincipal AND a 50 scaledDebtFee", () => {
        describe("WHEN 50 is proportionally scaled", () => {
          beforeEach(async () => {
            await poolEnv.scaleProportionally("0", "100", "50");
            scaledDebt = await poolEnv.getFpHarness().scaledDebt();
          });

          it("THEN the scaledDebtPrincipal is 0", async () => {
            expect(scaledDebt.principal).to.equal(parseUnits("0"));
          });

          it("THEN the scaledDebtFee is 50", async () => {
            expect(scaledDebt.fee).to.equal(parseUnits("50"));
          });
        });
      });

      describe("GIVEN a 0 scaledDebtPrincipal AND a 100 scaledDebtFee", () => {
        describe("WHEN 100 is proportionally scaled", () => {
          beforeEach(async () => {
            await poolEnv.scaleProportionally("0", "100", "100");
            scaledDebt = await poolEnv.getFpHarness().scaledDebt();
          });

          it("THEN the scaledDebtPrincipal is 0", async () => {
            expect(scaledDebt.principal).to.equal(parseUnits("0"));
          });

          it("THEN the scaledDebtFee is 100", async () => {
            expect(scaledDebt.fee).to.equal(parseUnits("100"));
          });
        });
      });
    });

    describe("reduceProportionally", () => {
      describe("GIVEN a 100 scaledDebtPrincipal AND a 100 scaledDebtFee", () => {
        describe("WHEN 50 is proportionally reduced", () => {
          beforeEach(async () => {
            await poolEnv.reduceProportionally("100", "100", "50");
            scaledDebt = await poolEnv.getFpHarness().scaledDebt();
          });

          it("THEN the scaledDebtPrincipal is 75", async () => {
            expect(scaledDebt.principal).to.equal(parseUnits("75"));
          });

          it("THEN the scaledDebtFee is 75", async () => {
            expect(scaledDebt.fee).to.equal(parseUnits("75"));
          });

          describe("AND WHEN another 150 is proportionally reduced", () => {
            beforeEach(async () => {
              await poolEnv.reduceProportionally("75", "75", "150");
              scaledDebt = await poolEnv.getFpHarness().scaledDebt();
            });

            it("THEN the scaledDebtPrincipal is 0", async () => {
              expect(scaledDebt.principal).to.equal(parseUnits("0"));
            });

            it("THEN the scaledDebtFee is 0", async () => {
              expect(scaledDebt.fee).to.equal(parseUnits("0"));
            });
          });
        });
      });

      describe("GIVEN a 100 scaledDebtPrincipal AND a 0 scaledDebtFee", () => {
        describe("WHEN 50 is proportionally reduced", () => {
          beforeEach(async () => {
            await poolEnv.reduceProportionally("100", "0", "50");
            scaledDebt = await poolEnv.getFpHarness().scaledDebt();
          });

          it("THEN the scaledDebtPrincipal is 50", async () => {
            expect(scaledDebt.principal).to.equal(parseUnits("50"));
          });

          it("THEN the scaledDebtFee is 0", async () => {
            expect(scaledDebt.fee).to.equal(parseUnits("0"));
          });
        });
      });

      describe("GIVEN a 0 scaledDebtPrincipal AND a 100 scaledDebtFee", () => {
        describe("WHEN 100 is proportionally reduced", () => {
          beforeEach(async () => {
            await poolEnv.reduceProportionally("0", "100", "100");
            scaledDebt = await poolEnv.getFpHarness().scaledDebt();
          });

          it("THEN the scaledDebtPrincipal is 0", async () => {
            expect(scaledDebt.principal).to.equal(parseUnits("0"));
          });

          it("THEN the scaledDebtFee is 0", async () => {
            expect(scaledDebt.fee).to.equal(parseUnits("0"));
          });
        });
      });
    });

    describe("setMaturity", () => {
      let newAccountBorrows: bigint;
      const userBorrowsWith56DayMaturity = 4_299_805_696;
      const userBorrowsWith56And84DayMaturity = 12_889_740_288;
      const userBorrowsWith28And56And84DayMaturity = 30_067_190_272;

      describe("GIVEN a 56 days maturity is added to the userBorrows", () => {
        beforeEach(async () => {
          await poolEnv.setMaturity(0, INTERVAL * 2);
          newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
        });

        it("THEN newAccountBorrows is userBorrowsWith56DayMaturity", async () => {
          expect(newAccountBorrows).to.equal(userBorrowsWith56DayMaturity);
        });

        describe("AND GIVEN another 56 days maturity is added to the userBorrows", () => {
          beforeEach(async () => {
            await poolEnv.setMaturity(userBorrowsWith56DayMaturity, INTERVAL * 2);
            newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
          });

          it("THEN newAccountBorrows is equal to the previous value", async () => {
            expect(newAccountBorrows).to.equal(userBorrowsWith56DayMaturity);
          });
        });

        describe("AND GIVEN a 84 days maturity is added to the userBorrows", () => {
          beforeEach(async () => {
            await poolEnv.setMaturity(userBorrowsWith56DayMaturity, INTERVAL * 3);
            newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
          });

          it("THEN newAccountBorrows has the result of both maturities", async () => {
            expect(newAccountBorrows).to.equal(userBorrowsWith56And84DayMaturity);
          });

          describe("AND GIVEN a 28 days maturity is added to the userBorrows", () => {
            beforeEach(async () => {
              await poolEnv.setMaturity(userBorrowsWith56And84DayMaturity, INTERVAL);
              newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
            });

            it("THEN newAccountBorrows has the result of the three maturities added", async () => {
              expect(newAccountBorrows).to.equal(userBorrowsWith28And56And84DayMaturity);
            });

            describe("AND GIVEN the 28 days maturity is removed from the userBorrows", () => {
              beforeEach(async () => {
                await poolEnv.clearMaturity(userBorrowsWith28And56And84DayMaturity, INTERVAL);
                newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
              });

              it("THEN newAccountBorrows has the result of the 56 and 84 days maturity", async () => {
                expect(newAccountBorrows).to.equal(userBorrowsWith56And84DayMaturity);
              });

              describe("AND GIVEN the 28 days maturity is removed again from the userBorrows", () => {
                it("THEN it should revert", async () => {
                  await expect(
                    poolEnv.clearMaturity(userBorrowsWith56And84DayMaturity, INTERVAL),
                  ).to.be.revertedWithPanic(0x11);
                });
              });

              describe("AND GIVEN the 86 days maturity is removed from the userBorrows", () => {
                beforeEach(async () => {
                  await poolEnv.clearMaturity(userBorrowsWith56And84DayMaturity, INTERVAL * 3);
                  newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
                });

                it("THEN newAccountBorrows has the result of the 56 days maturity", async () => {
                  expect(newAccountBorrows).to.equal(userBorrowsWith56DayMaturity);
                });

                describe("AND GIVEN the 86 days maturity is removed again from the userBorrows", () => {
                  beforeEach(async () => {
                    await poolEnv.clearMaturity(userBorrowsWith56DayMaturity, INTERVAL * 3);
                    newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
                  });

                  it("THEN newAccountBorrows has the result of the 56 days maturity", async () => {
                    expect(newAccountBorrows).to.equal(userBorrowsWith56DayMaturity);
                  });
                });

                describe("AND GIVEN the 56 days maturity is removed from the userBorrows", () => {
                  beforeEach(async () => {
                    await poolEnv.clearMaturity(userBorrowsWith56DayMaturity, INTERVAL * 2);
                    newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
                  });

                  it("THEN newAccountBorrows is emptied", async () => {
                    expect(newAccountBorrows).to.equal(0);
                  });
                });
              });
            });

            describe("AND GIVEN a 28 days maturity is removed from the userBorrows", () => {
              beforeEach(async () => {
                await poolEnv.clearMaturity(userBorrowsWith28And56And84DayMaturity, INTERVAL);
                newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
              });

              it("THEN newAccountBorrows has the result of the 56 and 84 days maturity", async () => {
                expect(newAccountBorrows).to.equal(userBorrowsWith56And84DayMaturity);
              });
            });
          });
        });
      });

      describe("GIVEN a 28 days maturity is tried to remove from the userBorrows that it's 0", () => {
        beforeEach(async () => {
          await poolEnv.clearMaturity(0, INTERVAL);
          newAccountBorrows = await poolEnv.fpHarness.newAccountBorrows();
        });

        it("THEN newAccountBorrows should still be 0", async () => {
          expect(newAccountBorrows).to.equal(0);
        });
      });
    });

    describe("distributeEarnings", () => {
      let lastBackupEarnings: bigint;
      let lastEarningsTreasury: bigint;

      describe("GIVEN 100 earnings, 1000 supplySP and 800 borrowAmount", () => {
        beforeEach(async () => {
          await poolEnv.distributeEarnings("100", "1000", "800");
          lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
          lastEarningsTreasury = await poolEnv.fpHarness.lastEarningsTreasury();
        });

        it("THEN lastBackupEarnings is 100", async () => {
          expect(lastBackupEarnings).to.equal(parseUnits("100"));
        });

        it("THEN lastEarningsTreasury is 0", async () => {
          expect(lastEarningsTreasury).to.equal(0);
        });
      });

      describe("GIVEN 100 earnings, 400 supplySP and 800 borrowAmount", () => {
        beforeEach(async () => {
          await poolEnv.distributeEarnings("100", "400", "800");
          lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
          lastEarningsTreasury = await poolEnv.fpHarness.lastEarningsTreasury();
        });

        it("THEN lastBackupEarnings is 50", async () => {
          expect(lastBackupEarnings).to.equal(parseUnits("50"));
        });

        it("THEN lastEarningsTreasury is 50", async () => {
          expect(lastEarningsTreasury).to.equal(parseUnits("50"));
        });
      });

      describe("GIVEN 100 earnings, 0 supplySP and 800 borrowAmount", () => {
        beforeEach(async () => {
          await poolEnv.distributeEarnings("100", "0", "800");
          lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
          lastEarningsTreasury = await poolEnv.fpHarness.lastEarningsTreasury();
        });

        it("THEN lastBackupEarnings is 0", async () => {
          expect(lastBackupEarnings).to.equal(0);
        });

        it("THEN lastEarningsTreasury is 100", async () => {
          expect(lastEarningsTreasury).to.equal(parseUnits("100"));
        });
      });

      describe("GIVEN 0 earnings, 0 supplySP and 800 borrowAmount", () => {
        beforeEach(async () => {
          await poolEnv.distributeEarnings("0", "0", "800");
          lastBackupEarnings = await poolEnv.fpHarness.lastBackupEarnings();
          lastEarningsTreasury = await poolEnv.fpHarness.lastEarningsTreasury();
        });

        it("THEN lastBackupEarnings is 0", async () => {
          expect(lastBackupEarnings).to.equal(0);
        });

        it("THEN lastEarningsTreasury is 0", async () => {
          expect(lastEarningsTreasury).to.equal(0);
        });
      });
    });
  });
});
