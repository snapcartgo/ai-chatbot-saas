// components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black border-t border-gray-900 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
        
        {/* Column 1: Brand */}
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="text-xl font-bold text-white mb-4 block">
            AI Chatbot <span className="text-blue-500">SaaS</span>
          </Link>
          <p className="text-gray-500 max-w-sm">
            Automating customer conversations and booking appointments with intelligent AI agents.
          </p>
        </div>

        {/* Column 2: Product */}
        <div>
          <h4 className="text-white font-bold mb-6">Product</h4>
          <ul className="space-y-4 text-gray-500 text-sm">
            <li><Link href="/features" className="hover:text-blue-500 transition">Features</Link></li>
            <li><Link href="/dashboard/Billing"className="hover:text-blue-500 transition">Pricing</Link></li>
            <li><Link href="/dashboard" className="hover:text-blue-500 transition">View Dashboard</Link></li>
            <li><Link href="/blog" className="hover:text-blue-500 transition">Blog</Link></li>
          </ul>
        </div>

        {/* Column 3: Business / Partners */}
        <div>
          <h4 className="text-white font-bold mb-6">Business</h4>
          <ul className="space-y-4 text-gray-500 text-sm">
            {/* THIS IS YOUR PARTNER LINK */}
            <li>
              <Link href="/partners" className="hover:text-blue-500 transition">
                Partner Program
                </Link>
            </li>
            <li><Link href="/contact" className="hover:text-blue-500 transition">Contact Us</Link></li>
            <li><Link href="/terms" className="hover:text-blue-500 transition">Terms of Service</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-gray-900 text-center text-gray-600 text-xs">
        © {currentYear} AI Chatbot SaaS. All rights reserved.
      </div>
    </footer>
  );
}