export async function connectWallet() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask not detected");
  }
  const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
  return account as string;
}

export async function signMessage(message: string, wallet: string) {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask not detected");
  }
  const signature = await (window as any).ethereum.request({
    method: "personal_sign",
    params: [message, wallet],
  });
  return signature as string;
}
