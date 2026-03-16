import nextCoreVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreVitals,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
