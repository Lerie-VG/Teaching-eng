'use client';

import { useState } from 'react';
import WritingAnalyzer from '@/components/WritingAnalyzer';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Cambridge CAE/CPE Writing Analyzer
        </h1>
        <WritingAnalyzer />
      </div>
    </main>
  );
}
