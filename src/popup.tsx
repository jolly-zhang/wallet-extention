import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "./components/ui/sonner";
import { Toaster } from "./components/ui/toaster";
import { ConnectRequest } from "./components/wallet/ConnectRequest";
import { SendRequest } from "./components/wallet/SendRequest";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import "./style.css";
import React from "react";

const queryClient = new QueryClient({})
export default function popup() {
  // 获取当前路径
  const currentPath = window.location.pathname
  const popupAction = new URLSearchParams(window.location.search).get('action')
  console.log("currentPath", currentPath)
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {popupAction === 'connect' || popupAction === 'send' ? (
          <div className="w-full min-h-screen bg-background">
            {popupAction === 'connect' ? <ConnectRequest /> : <SendRequest />}
          </div>
        ) : (
          <BrowserRouter>
            <Routes>
              <Route path="/popup.html" element={<div className="w-[400px]"><Index /></div> } />
              <Route path="*" element={<div className="w-[400px]"><NotFound /></div>} />
            </Routes>
          </BrowserRouter>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  )
}
