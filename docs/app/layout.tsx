import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Provider } from "@/components/provider";
import "./global.css";

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html className={`${GeistSans.variable} ${GeistMono.variable}`} lang="en" suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				<Provider>{children}</Provider>
			</body>
		</html>
	);
}
