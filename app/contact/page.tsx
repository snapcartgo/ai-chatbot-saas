"use client";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-16 flex justify-center">
      <div className="max-w-2xl w-full">

        {/* ✅ Heading */}
        <h1 className="text-4xl font-bold mb-4 text-center">
          Contact Us
        </h1>

        {/* ✅ Description */}
        <p className="text-gray-400 text-center mb-10">
          Have questions, feedback, or need help?  
          Our team is here to support you. Reach out anytime.
        </p>

        {/* ✅ Contact Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <p className="mb-2"><strong>Email:</strong> aiautomation2424@gmail.com </p>
          <p><strong>Phone:</strong> +91 9878498214</p>
        </div>

        {/* ✅ Simple Form */}
        <p className="text-red-400 text-sm mb-4 text-center">
  ⚠️ Only business inquiries with a valid website will be considered.
</p>
        <form className="space-y-4 bg-gray-900 border border-gray-800 p-6 rounded-xl">

  {/* Name */}
  <input
    type="text"
    placeholder="Your Name"
    required
    className="w-full p-3 rounded-lg bg-black border border-gray-700"
  />

  {/* Email */}
  <input
    type="email"
    placeholder="Your Email"
    required
    className="w-full p-3 rounded-lg bg-black border border-gray-700"
  />

  {/* Website URL ✅ NEW */}
  <input
    type="url"
    placeholder="Your Website (Required)"
    required
    className="w-full p-3 rounded-lg bg-black border border-gray-700"
  />

  {/* Message */}
  <textarea
    placeholder="Tell us what you need..."
    rows={4}
    required
    className="w-full p-3 rounded-lg bg-black border border-gray-700"
  />

  {/* Button */}
  <button className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded-lg font-bold">
    Send Message
  </button>

</form>

      </div>
    </div>
  );
}