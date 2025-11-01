import Haikunator from "haikunator";

const haikunator = new Haikunator({
  defaults: {
    tokenLength: 2,
    tokenHex: false,
    delimiter: "-",
  },
});

export const generateSlug = (): string => haikunator.haikunate();
