import "./globals.css";
import Shell from "@/components/Shell";

export const metadata = {
  title: "Cicero Online",
  description: "Shop and online sales, stock, suppliers and payments",
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#16151a" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
