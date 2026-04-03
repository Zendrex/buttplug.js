import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Script from "next/script";

import { Provider } from "@/components/provider";
import "./global.css";

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html className={`${GeistSans.variable} ${GeistMono.variable}`} lang="en" suppressHydrationWarning>
			<head>
				{process.env.NODE_ENV === "development" && (
					<Script src="https://unpkg.com/react-scan/dist/auto.global.js" strategy="beforeInteractive" />
				)}
			</head>
			<body className="flex min-h-screen flex-col">
				<Provider>{children}</Provider>
			</body>
		</html>
	);
}
