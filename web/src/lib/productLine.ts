export type ProductLine = "ft" | "pu" | "ppt" | "other";

export function inferProductLine(campaignName: string): ProductLine {
  const lower = campaignName.toLowerCase();

  // 允许前缀后面跟下划线 / 连字符 / 空格 / 直接结束
  const isPrefix = (prefix: string) => {
    if (!lower.startsWith(prefix)) return false;
    const next = lower[prefix.length];
    return !next || next === "_" || next === "-" || next === " ";
  };

  if (isPrefix("ft")) return "ft";
  if (isPrefix("pu")) return "pu";
  if (isPrefix("ppt")) return "ppt";

  return "other";
}

