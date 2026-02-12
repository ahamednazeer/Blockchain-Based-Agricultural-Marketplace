import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  solidity: "0.8.24",
  networks: {
    ganache: {
      url: process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545",
    },
  },
};

export default config;
