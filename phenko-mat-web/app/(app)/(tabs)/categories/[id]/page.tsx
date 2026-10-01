import Link from "next/link";
import { CategoryTitle } from "@/components/CategoryTitle";
import { ArrowLeftIcon } from "@/components/icons";
import { SwipeDeck } from "@/components/SwipeDeck";

export default async function CategoryDeckPage({ params }: PageProps<"/categories/[id]">) {
  const { id } = await params;
  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-3 md:mx-auto md:w-full md:max-w-[480px] md:pt-8 md:pb-5">
        <Link
          href="/categories"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="Back to categories"
        >
          <ArrowLeftIcon size={18} />
        </Link>
        <CategoryTitle id={id} />
      </div>
      <SwipeDeck categoryId={id} />
    </>
  );
}
