'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AddProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    try {
      setLoading(true)

      if (!name || !price || !description || !category || !image) {
        alert('Please fill all fields')
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('User session not found. Please log in again.')
        return
      }

      const fileName = `${Date.now()}-${image.name}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, image)

      if (uploadError) {
        console.log(uploadError)
        alert('Image upload failed')
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      const imageUrl = publicUrlData.publicUrl

      const { error: dbError } = await supabase
        .from('products')
        .insert([
          {
            user_id: user.id,
            name,
            price: Number(price),
            description,
            category,
            image_url: imageUrl,
          },
        ])

      if (dbError) {
        console.log(dbError)
        alert('Failed to save product')
        return
      }

      alert('Product saved successfully')

      setName('')
      setPrice('')
      setDescription('')
      setCategory('')
      setImage(null)

      router.push('/dashboard/products')
      router.refresh()
    } catch (error) {
      console.log(error)
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">
        Add Product
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block mb-2 font-medium">
            Product Name
          </label>

          <input
            type="text"
            placeholder="Enter product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            Price
          </label>

          <input
            type="number"
            placeholder="Enter price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            Description
          </label>

          <textarea
            placeholder="Enter description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded h-32"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            Category
          </label>

          <input
            type="text"
            placeholder="Enter category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            Product Image
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setImage(e.target.files?.[0] || null)
            }
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-black text-white px-6 py-3 rounded"
        >
          {loading ? 'Saving...' : 'Save Product'}
        </button>
      </div>
    </div>
  )
}