"use client";

export type DeviceNotificationOptions = {
  body: string;
  tag: string;
  url?: string;
};

export function deviceNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return window.Notification.permission;
}

export async function requestDeviceNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  return window.Notification.requestPermission();
}

export async function showDeviceNotification(title: string, options: DeviceNotificationOptions) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    window.Notification.permission !== "granted" ||
    !("serviceWorker" in navigator)
  ) {
    return false;
  }

  try {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) registration = await navigator.serviceWorker.register("/sw.js");

    await registration.showNotification(title, {
      body: options.body,
      tag: options.tag,
      icon: "/kasirkita-mark.png",
      badge: "/kasirkita-mark.png",
      data: { url: options.url ?? "/admin" },
    });
    return true;
  } catch {
    return false;
  }
}
