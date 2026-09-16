import { cn } from "../lib/utils";

interface PRISMAProps {
  counts: {
    identified: number;
    duplicates: number;
    screened: number;
    titleAbstractExcluded: number;
    fullTextAssessed: number;
    fullTextExcluded: number;
    included: number;
  }
}

export function PRISMADiagram({ counts }: PRISMAProps) {
  const { identified, duplicates, screened, titleAbstractExcluded, fullTextAssessed, fullTextExcluded, included } = counts;

  return (
    <div className="flex flex-col items-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full mx-auto shadow-sm tracking-tight text-sm">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 font-display self-start">PRISMA Flow Diagram</h3>
      
      <div className="flex flex-col items-center w-full max-w-2xl relative">
        {/* IDENTIFICATION */}
        <div className="flex w-full min-h-[90px] relative mb-12">
          <div className="w-1/2 flex justify-center items-center relative">
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 p-5 w-64 text-center relative z-10 rounded-md">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Records identified</span>
              <div className="font-bold text-lg text-slate-900 dark:text-white mt-1">(n = {identified})</div>
            </div>
            {/* Arrow connecting to duplicate removal */}
            <div className="absolute top-1/2 left-[100%] ml-[-32px] w-20 border-t-2 border-slate-400 dark:border-slate-600 pointer-events-none z-0"></div>
          </div>
          <div className="w-1/2 flex items-center justify-end pl-8">
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 p-5 w-64 text-left rounded-md">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Records removed:</span><br/>
              <span className="text-slate-700 dark:text-slate-300">Duplicate records (n = {duplicates})</span>
            </div>
          </div>
        </div>

        {/* Down Arrow 1 */}
        <div className="absolute top-[90px] left-1/4 transform -translate-x-1/2 w-0 h-12 border-l-2 border-slate-400 dark:border-slate-600">
           <div className="absolute -bottom-1 -left-[5px] border-solid border-t-8 border-x-[4px] border-x-transparent border-t-slate-400 dark:border-t-slate-600" />
        </div>

        {/* SCREENING (TITLE/ABSTRACT) */}
        <div className="flex w-full relative mb-12">
          <div className="w-1/2 flex justify-center items-center relative">
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 p-5 w-64 text-center relative z-10 rounded-md">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Records screened</span>
              <div className="font-bold text-lg text-slate-900 dark:text-white mt-1">(n = {screened})</div>
            </div>
            {/* Arrow connecting to exclusions */}
            <div className="absolute top-1/2 left-[100%] ml-[-32px] w-20 border-t-2 border-slate-400 dark:border-slate-600 pointer-events-none z-0"></div>
          </div>
          <div className="w-1/2 flex items-center justify-end pl-8">
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 p-5 w-64 text-left rounded-md">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Records excluded:</span><br/>
              <span className="text-slate-700 dark:text-slate-300">(n = {titleAbstractExcluded})</span>
            </div>
          </div>
        </div>

        {/* Down Arrow 2 */}
        <div className="absolute top-[236px] left-1/4 transform -translate-x-1/2 w-0 h-12 border-l-2 border-slate-400 dark:border-slate-600">
           <div className="absolute -bottom-1 -left-[5px] border-solid border-t-8 border-x-[4px] border-x-transparent border-t-slate-400 dark:border-t-slate-600" />
        </div>

        {/* FULL TEXT & EXCLUSION */}
        <div className="flex w-full relative mb-12">
          <div className="w-1/2 flex justify-center items-center relative">
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 p-5 w-64 text-center relative z-10 rounded-md">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Full-text accessed</span>
              <div className="font-bold text-lg text-slate-900 dark:text-white mt-1">(n = {fullTextAssessed})</div>
            </div>
            {/* Arrow connecting to exclusions */}
            <div className="absolute top-1/2 left-[100%] ml-[-32px] w-20 border-t-2 border-slate-400 dark:border-slate-600 pointer-events-none z-0"></div>
          </div>
          <div className="w-1/2 flex items-center justify-end pl-8">
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 p-5 w-64 text-left rounded-md">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Records excluded:</span><br/>
              <span className="text-slate-700 dark:text-slate-300">(n = {fullTextExcluded})</span>
            </div>
          </div>
        </div>

        {/* Down Arrow 3 */}
        <div className="absolute top-[382px] left-1/4 transform -translate-x-1/2 w-0 h-12 border-l-2 border-slate-400 dark:border-slate-600">
           <div className="absolute -bottom-1 -left-[5px] border-solid border-t-8 border-x-[4px] border-x-transparent border-t-slate-400 dark:border-t-slate-600" />
        </div>

        {/* INCLUDED */}
        <div className="flex w-full relative">
          <div className="w-1/2 flex justify-center items-center">
            <div className="bg-slate-50 dark:bg-indigo-900/20 border-2 border-slate-400 dark:border-indigo-500/50 p-5 w-64 text-center relative z-10 rounded-md">
               <span className="font-semibold text-slate-800 dark:text-indigo-200">Studies included</span>
               <div className="font-bold text-lg text-slate-900 dark:text-white mt-1">(n = {included})</div>
            </div>
          </div>
        </div>

      </div>
      
      {/* Tabular Representation */}
      <div className="mt-16 w-full max-w-2xl border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Phase</th>
              <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right">Count (n)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            <tr><td className="px-4 py-3 text-slate-800 dark:text-slate-200">Records identified</td><td className="px-4 py-3 font-semibold text-right text-slate-900 dark:text-white">{identified}</td></tr>
            <tr><td className="px-4 py-3 text-slate-800 dark:text-slate-200 pl-8 text-slate-600 dark:text-slate-400 border-l-[3px] border-transparent">Duplicate records removed</td><td className="px-4 py-3 font-semibold text-right text-slate-600 dark:text-slate-400">{duplicates}</td></tr>
            <tr><td className="px-4 py-3 text-slate-800 dark:text-slate-200">Records screened (Title/Abstract)</td><td className="px-4 py-3 font-semibold text-right text-slate-900 dark:text-white">{screened}</td></tr>
            <tr><td className="px-4 py-3 text-slate-800 dark:text-slate-200 pl-8 text-slate-600 dark:text-slate-400 border-l-[3px] border-transparent">Records excluded</td><td className="px-4 py-3 font-semibold text-right text-slate-600 dark:text-slate-400">{titleAbstractExcluded}</td></tr>
            <tr><td className="px-4 py-3 text-slate-800 dark:text-slate-200">Full-text articles assessed</td><td className="px-4 py-3 font-semibold text-right text-slate-900 dark:text-white">{fullTextAssessed}</td></tr>
            <tr><td className="px-4 py-3 text-slate-800 dark:text-slate-200 pl-8 text-slate-600 dark:text-slate-400 border-l-[3px] border-transparent">Full-text articles excluded</td><td className="px-4 py-3 font-semibold text-right text-slate-600 dark:text-slate-400">{fullTextExcluded}</td></tr>
            <tr className="bg-slate-50 dark:bg-indigo-900/10"><td className="px-4 py-3 font-bold text-slate-900 dark:text-indigo-200">Studies included in scoping review</td><td className="px-4 py-3 font-bold text-right text-slate-900 dark:text-white">{included}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
