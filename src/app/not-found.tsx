import Link from 'next/link';
import React from 'react';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      
      {/* Actual Shining Bulb Image */}
      <div className="relative mb-6 drop-shadow-[0_0_50px_rgba(250,204,21,0.3)] select-none">
        <Image 
          src="/bulb.png" 
          alt="Shining Bulb" 
          width={350} 
          height={350} 
          className="object-contain animate-[pulse_4s_ease-in-out_infinite] scale-110"
          priority
        />
      </div>

      <div className="flex flex-col items-center z-10 text-center space-y-4 max-w-lg mt-[-20px]">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-wide text-neutral-200">
          404 Error
        </h1>
        
        <p className="text-neutral-400 text-lg md:text-xl font-light">
          It looks like your problems have to wait for some time.
        </p>

        <div className="pt-8">
          <Link 
            href="/"
            className="px-8 py-3 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800 transition-colors font-medium text-neutral-300"
          >
            Go Back
          </Link>
        </div>
      </div>
    </div>
  );
}
