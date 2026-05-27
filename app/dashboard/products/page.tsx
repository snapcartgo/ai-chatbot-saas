'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  image_url: string
}

export default function ProductsPage() {

  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setProducts(data || [])
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

      {/* Products Grid */}
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

    </div>
  )
}