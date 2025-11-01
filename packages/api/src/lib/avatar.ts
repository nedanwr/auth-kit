export const generateAvatar = (userId: string) =>
  `https://api.dicebear.com/8.x/glass/png?seed=${userId}&size=128&radius=50&backgroundType=gradientLinear`;
