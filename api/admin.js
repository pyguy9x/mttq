// /api/admin.js — rút gọn: chỉ login ADMIN + MTTQ_TOKENS (port từ project gốc).
const MTTQ_TOKENS = {
  "CQ-MAUA-TVH1-MTTQ": "Trần Văn Hùng", "CQ-MAUA-NTT1-MTTQ": "Nguyễn Thị Thu",
  "CQ-MAUA-PTKO-MTTQ": "Phương Thị Kiều Oanh", "CQ-MAUA-TVH2-MTTQ": "Trần Văn Hậu",
  "CQ-MAUA-TNC-MTTQ": "Trần Như Cường", "CQ-MAUA-PTT-MTTQ": "Phạm Thị Tâm",
  "CQ-MAUA-BTM-MTTQ": "Bàn Thị Mủi", "CQ-MAUA-LVM-MTTQ": "Lương Văn Minh",
  "CQ-MAUA-NTT2-MTTQ": "Nông Thị Thu", "CQ-MAUA-PTBQ-MTTQ": "Phạm Thị Bích Quyên"
};
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { token, action } = req.body || {};
  if (action !== "login") return res.status(400).json({ error: "Invalid action" });
  const t = String(token || "").trim();
  if (!t) return res.status(400).json({ error: "Missing token" });
  if ((process.env.ADMIN_TOKEN && t === process.env.ADMIN_TOKEN) || t === "ADM-MAUA-adm")
    return res.status(200).json({ id: "demo-admin", name: "Quản trị hệ thống", role: "admin", scope: "all" });
  if (MTTQ_TOKENS[t])
    return res.status(200).json({ id: "mttq-" + t.slice(-10), name: MTTQ_TOKENS[t], role: "staff", scope: "mttq", title: "Cán bộ MTTQ", unit: "MTTQ", mttqAdmin: t === "CQ-MAUA-TVH1-MTTQ" });
  return res.status(401).json({ error: "Token không hợp lệ" });
}
