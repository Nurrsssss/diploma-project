'use client'
import Link from 'next/link'
import { IoClose } from "react-icons/io5";
import { HiMenuAlt4 } from "react-icons/hi";
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

export default function IsNotLoggedIn() {

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <header className="flex justify-between fixed top-0 left-0 right-0 md:py-1 z-50 border-b border-primary/10 bg-lightBg/90 shadow-soft backdrop-blur-md supports-[backdrop-filter]:bg-lightBg/75">
            <nav className="container">
                <ul className="flex justify-between items-center py-1 text-xl font-semibold">
                    <li>
                        <Link href="/" className="flex items-center gap-2">
                            <span className="ml-5 font-ibm text-[32px] font-bold leading-[100%] text-slate-800 md:ml-0">
                                Clintech<span className="text-primary">AI</span>
                            </span>
                        </Link>
                    </li>

                    <li className="hidden md:block lg:flex items-center">
                        <Link
                            href="/register"
                            className="rounded-[50px] border border-primary bg-primary/10 px-6 py-3 font-ibm text-primary transition-all duration-300 hover:bg-primary hover:text-white"
                        >
                            Регистрация
                        </Link>

                        <Link
                            href="/login"
                            className="ml-6 rounded-[50px] bg-primary px-6 py-3 font-ibm text-white transition-all duration-300 hover:bg-primaryDark"
                        >
                            Войти
                        </Link>
                    </li>

                    {/* Burger Menu Button */}
                    <li className="md:hidden">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="rounded-lg p-2 text-primary transition-all duration-300 hover:bg-primary/10"
                        >
                            {mobileMenuOpen ? (
                                <IoClose className="w-10 h-10" />
                            ) : (
                                <HiMenuAlt4 className="w-10 h-10" />
                            )}
                        </button>
                    </li>
                </ul>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                            className="md:hidden absolute top-full left-0 right-0 border-t border-slate-200/80 bg-white/95 shadow-card backdrop-blur-md"
                        >
                            <div className="container py-4">
                                <ul className="flex flex-col gap-4">
                                    <li>
                                        <Link
                                            href="/register"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="block w-full rounded-[50px] border border-primary bg-primary/10 px-6 py-3 text-center font-ibm text-primary transition-all duration-300 hover:bg-primary hover:text-white"
                                        >
                                            Регистрация
                                        </Link>
                                    </li>

                                    <li>
                                        <Link
                                            href="/login"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="block w-full rounded-[50px] bg-primary px-6 py-3 text-center font-ibm text-white transition-all duration-300 hover:bg-primaryDark"
                                        >
                                            Войти
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    )
}
