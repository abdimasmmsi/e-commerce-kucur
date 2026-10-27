import { useLiveRefresh } from "../utils/liveRefresh";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { NOTIFICATIONS_REFRESH_EVENT, notificationService, resolveNotificationRoute } from "../services/notificationService";
import { requestNotificationPermission } from "../services/browserNotificationService";
const NotificationContext = createContext(null); const PAGE_SIZE = 20;
export function NotificationProvider({ children }) {
  const { activeRole, user } = useAuth(); const [notifications,setNotifications]=useState([]); const [unreadCount,setUnreadCount]=useState(0); const [page,setPage]=useState(1); const [total,setTotal]=useState(0); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const normalize=useCallback((items)=>(items||[]).map((item)=>({...item,link:resolveNotificationRoute(item,activeRole)})),[activeRole]);
  const refreshNotifications=useCallback(async()=>{if(!user?.id){setNotifications([]);setUnreadCount(0);setTotal(0);return;}setLoading(true);try{const result=await notificationService.list({page:1,limit:PAGE_SIZE});setNotifications(normalize(result.items));setUnreadCount(result.unreadCount||0);setTotal(result.pagination?.total||0);setPage(1);setError("");}catch(cause){setError(cause.message);}finally{setLoading(false);}},[normalize,user?.id]);
  // Notifikasi yang ditandai terbaca dari tempat lain (mis. membuka chat) → muat ulang lonceng.
  useEffect(()=>{const refresh=()=>{void refreshNotifications();};window.addEventListener(NOTIFICATIONS_REFRESH_EVENT,refresh);return()=>window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT,refresh);},[refreshNotifications]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void refreshNotifications();},0);return()=>window.clearTimeout(timer);},[refreshNotifications]);
  useEffect(()=>{if(!user?.id||!("Notification" in window)||Notification.permission!=="default")return;const timer=window.setTimeout(()=>{void requestNotificationPermission();},400);return()=>window.clearTimeout(timer);},[user?.id]);
  // Muat ulang diam-diam: ganti halaman pertama dengan data baru, daftar yang sudah dimuat lebih jauh tetap; galat diabaikan.
  const silentRefreshNotifications=useCallback(async()=>{if(!user?.id)return;try{const result=await notificationService.list({page:1,limit:PAGE_SIZE});const fresh=normalize(result.items);const ids=new Set(fresh.map((item)=>item.id));setNotifications((rows)=>[...fresh,...rows.filter((row)=>!ids.has(row.id))]);setUnreadCount(result.unreadCount||0);setTotal(result.pagination?.total||0);}catch{/* data lama tetap tampil */}},[normalize,user?.id]);
  useLiveRefresh(silentRefreshNotifications,{enabled:Boolean(user?.id)});
  const loadMore=useCallback(async()=>{if(loading||notifications.length>=total)return;setLoading(true);try{const next=page+1;const result=await notificationService.list({page:next,limit:PAGE_SIZE});setNotifications((rows)=>[...rows,...normalize(result.items)]);setUnreadCount(result.unreadCount||0);setPage(next);setError("");}catch(cause){setError(cause.message);}finally{setLoading(false);}},[loading,normalize,notifications.length,page,total]);
  const isRead=useCallback((item)=>Boolean(item.readAt),[]);
  const markRead=useCallback(async(id)=>{const current=notifications.find((row)=>row.id===id);if(current?.readAt)return;await notificationService.markRead(id);setNotifications((rows)=>rows.map((row)=>row.id===id?{...row,readAt:new Date().toISOString(),isRead:true}:row));setUnreadCount((value)=>Math.max(0,value-1));},[notifications]);
  const markAllRead=useCallback(async()=>{await notificationService.markAllRead();const now=new Date().toISOString();setNotifications((rows)=>rows.map((row)=>({...row,readAt:row.readAt||now,isRead:true})));setUnreadCount(0);},[]);
  const value=useMemo(()=>({notifications,unreadCount,isRead,markRead,markAllRead,refreshNotifications,loadMore,hasMore:notifications.length<total,loading,error}),[notifications,unreadCount,isRead,markRead,markAllRead,refreshNotifications,loadMore,total,loading,error]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications(){const context=useContext(NotificationContext);if(!context)throw new Error("useNotifications must be used inside NotificationProvider");return context;}
