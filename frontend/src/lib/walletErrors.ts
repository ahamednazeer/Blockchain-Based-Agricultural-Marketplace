type UnknownError = {
  code?: number | string;
  shortMessage?: string;
  reason?: string;
  message?: string;
  error?: { code?: number | string; message?: string };
  info?: { error?: { code?: number | string; message?: string } };
};

function normalizeMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function getReadableWalletError(error: unknown, fallback = "Transaction failed") {
  const err = (error || {}) as UnknownError;
  const code = err.code ?? err.error?.code ?? err.info?.error?.code;
  const rawMessage = normalizeMessage(
    String(
      err.shortMessage ||
        err.reason ||
        err.info?.error?.message ||
        err.error?.message ||
        err.message ||
        ""
    )
  );
  const message = rawMessage.toLowerCase();

  if (
    code === 4001 ||
    code === "ACTION_REJECTED" ||
    message.includes("user denied") ||
    message.includes("ethers-user-denied")
  ) {
    return "Transaction cancelled in MetaMask.";
  }

  if (
    message.includes("could not coalesce error") &&
    message.includes("rpc endpoint returned too many errors")
  ) {
    return "RPC endpoint is unstable right now. Wait a few seconds and retry.";
  }

  if (message.includes("insufficient funds")) {
    return "Insufficient ETH for amount plus gas fee.";
  }

  if (message.includes("missing revert data")) {
    return "Transaction reverted on-chain. Refresh listings and try again.";
  }

  if (rawMessage) {
    return rawMessage.length > 180 ? `${rawMessage.slice(0, 177)}...` : rawMessage;
  }

  return fallback;
}
