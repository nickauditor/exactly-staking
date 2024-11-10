import { inspect } from "util";
import { deployments, ethers, getNamedAccounts } from "hardhat";

const { isAddress, isHexString, Contract, provider } = ethers;

inspect.defaultOptions.depth = null;

export default async function format(v: unknown): Promise<unknown> {
  if (typeof v === "string") {
    const allDeployments = await deployments.all();

    if (isAddress(v)) {
      const deployment = Object.entries(allDeployments).filter(([, { address }]) => v === address);
      if (deployment.length) return deployment.sort(([a], [b]) => a.length - b.length)[0][0];

      const account = Object.entries(await getNamedAccounts()).find(([, address]) => v === address);
      if (account) return account[0];
    }

    if (isHexString(v, 32)) {
      for (const { address, abi } of Object.values(allDeployments)) {
        if (!abi) continue;

        for (const { name } of abi.filter(
          ({ type, stateMutability, inputs, outputs }) =>
            type === "function" &&
            stateMutability === "view" &&
            !inputs?.length &&
            outputs.length === 1 &&
            outputs[0].internalType === "bytes32",
        )) {
          if (v === (await new Contract(address, abi, provider)[name]().catch(() => null))) return name;
        }
      }
    }
  }

  if (Array.isArray(v)) return Promise.all(v.map(format));

  if (v && typeof v === "object") {
    return Object.fromEntries(await Promise.all(Object.entries(v).map(async ([k, v_]) => [k, await format(v_)])));
  }

  return v;
}
