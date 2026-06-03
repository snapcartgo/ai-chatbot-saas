'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  image_url: string
  user_id: string | null
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.log(error)
      setLoading(false)
      return
    }

    setProducts(data || [])
    setLoading(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">
          Products
        </h1>

        <Link href="/dashboard/products/add">
          <button className="bg-black text-white px-4 py-2 rounded">
            Add Product
          </button>
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading products...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="border rounded-lg p-4 bg-white shadow"
            >
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-48 object-cover rounded"
              />

              <h2 className="text-xl font-bold mt-4">
                {product.name}
              </h2>

              <p className="text-gray-600 mt-2">
                {product.description}
              </p>

              <p className="font-bold mt-3">
                ₹{product.price}
              </p>

              <p className="text-sm text-gray-500 mt-1">
                {product.category}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}