import "./globals.css";
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const metadata = {
  title: "Weekly — A little clarity for your money",
  description: "Your paycheck, with a plan.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
