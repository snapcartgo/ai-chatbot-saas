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