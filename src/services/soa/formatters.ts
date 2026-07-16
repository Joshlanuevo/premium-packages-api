export function formatCurrency(amount: number | null | undefined, currency: string = "PHP"): string {
  const value = Number(amount ?? 0);

  if (currency === "PHP") {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function getReadableDate(date: Date | string | null | undefined, _unused?: boolean): string {
  if (!date) return "TBA";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}