"use client";

import { create } from "@orama/orama";
import { useDocsSearch } from "fumadocs-core/search/client";
import {
	SearchDialog,
	SearchDialogClose,
	SearchDialogContent,
	SearchDialogHeader,
	SearchDialogIcon,
	SearchDialogInput,
	SearchDialogList,
	SearchDialogOverlay,
	type SharedProps,
} from "fumadocs-ui/components/dialog/search";

function initOrama() {
	return create({
		schema: { _: "string" },
		language: "english",
	});
}

export default function DefaultSearchDialog(props: SharedProps) {
	const { search, setSearch, query } = useDocsSearch({
		type: "static",
		from: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search`,
		initOrama,
	});

	return (
		<SearchDialog isLoading={query.isLoading} onSearchChange={setSearch} search={search} {...props}>
			<SearchDialogOverlay />
			<SearchDialogContent>
				<SearchDialogHeader>
					<SearchDialogIcon />
					<SearchDialogInput />
					<SearchDialogClose />
				</SearchDialogHeader>
				<SearchDialogList items={query.data !== "empty" ? query.data : null} />
			</SearchDialogContent>
		</SearchDialog>
	);
}
