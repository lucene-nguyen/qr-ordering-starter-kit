const vnd = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** Integer VND → "65.000đ". */
export const formatVnd = (amount: number) => `${vnd.format(amount)}đ`;
