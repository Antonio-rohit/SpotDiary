'use client';

import React from 'react';
import { CATEGORIES } from '@spotdiary/shared';

interface CategoryFilterPillsProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export default function CategoryFilterPills({
  selectedCategory,
  onSelectCategory
}: CategoryFilterPillsProps) {
  const allCategories = ['All', ...CATEGORIES];

  return (
    <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 px-1">
      {allCategories.map((cat) => {
        const isActive = selectedCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-smooth flex-shrink-0 ${
              isActive
                ? 'bg-[#254542] text-white shadow-md scale-105'
                : 'bg-white text-[#273C3A] border border-[#E8E7DF] hover:bg-[#F8F5EE]'
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
