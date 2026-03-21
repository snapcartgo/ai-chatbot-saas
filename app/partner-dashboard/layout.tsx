export default function PartnerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "black", color: "white", minHeight: "100vh" }}>
      {/* NO HEADER / NO FOOTER */}
      {children}
    </div>
  );
}