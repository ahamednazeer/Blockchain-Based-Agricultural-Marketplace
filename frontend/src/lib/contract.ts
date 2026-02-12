import { ethers } from "ethers";
import { api } from "./api";

export async function getContract() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask not detected");
  }

  const meta = await api.getContractMeta();
  if (!meta?.address || !meta?.abi) {
    throw new Error("Contract metadata unavailable");
  }

  if (meta.chainId) {
    const chainIdHex = `0x${meta.chainId.toString(16)}`;
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch {
      // Ignore switch failures; user can switch manually
    }
  }

  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(meta.address, meta.abi, signer);
}
