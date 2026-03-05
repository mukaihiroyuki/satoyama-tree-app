export const COMPANY_INFO = {
  name: "株式会社みちのく庭園",
  representative: "代表取締役　橋本　忍",
  postalCode: "〒039-1161",
  address: "青森県八戸市大字河原木字簀子渡15-3",
  tel: "0178-28-0130",
  fax: "0178-20-1217",
} as const;

export const STAFF = [
  { name: "橋本忍", pin: "0001" },
  { name: "向中野大志", pin: "0002" },
  { name: "小笠原久美子", pin: "0003" },
  { name: "細越未紀", pin: "0004" },
  { name: "橋本渚", pin: "0005" },
  { name: "田中俊宏", pin: "0006" },
  { name: "中村勉", pin: "0007" },
] as const;

export const ASSIGNEES = STAFF.map(s => s.name);
