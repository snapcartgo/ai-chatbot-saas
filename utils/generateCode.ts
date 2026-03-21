// utils/generateCode.ts
export const generatePartnerCode = (businessName: string) => {
  const prefix = businessName.toUpperCase().replace(/\s/g, '').substring(0, 3);
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${random}`; // e.g., AZA-X82F1
};
