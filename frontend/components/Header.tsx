import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold text-brand">Infinix</Link>
        <nav className="flex gap-6 text-sm text-gray-600">
          <Link href="/products" className="hover:text-brand">Shop</Link>
        </nav>
        {/* Cart icon / login link get added here in Step 7 once cart+auth
           UI exist on the frontend — kept out for now rather than adding
           a link to a page that doesn't exist yet. */}
      </div>
    </header>
  );
}
