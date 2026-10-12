"""Notification permission and scheduling contract checks; no real OS delivery."""
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(reduced_motion='reduce')
    page.goto('http://127.0.0.1:4173/#classroom')
    page.get_by_role('button',name='开启每日提醒').click()
    expect(page.locator('#reminder-status')).to_contain_text('安卓 App')
    page.evaluate('''window.notificationCalls=[];window.notificationPermission='denied';
      window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{
        checkPermissions:async()=>({display:window.notificationPermission}),
        requestPermissions:async()=>({display:window.notificationPermission}),
        createChannel:async c=>notificationCalls.push({channel:c}),
        schedule:async s=>notificationCalls.push({schedule:s}),
        cancel:async s=>notificationCalls.push({cancel:s})
      }}};''')
    page.get_by_role('button',name='开启每日提醒').click()
    expect(page.locator('#reminder-status')).to_contain_text('没有获得通知权限')
    assert page.evaluate('notificationCalls.length')==0
    page.evaluate("notificationPermission='granted'")
    page.get_by_role('button',name='开启每日提醒').click()
    expect(page.locator('#reminder-status')).to_contain_text('已设置')
    notice=page.evaluate('notificationCalls[1].schedule.notifications[0]')
    assert notice['id']==9001
    assert notice['isExactNotification'] is False
    assert notice['schedule']['on']=={'hour':9,'minute':0}
    page.get_by_role('button',name='关闭提醒').click()
    expect(page.locator('#reminder-status')).to_contain_text('已关闭')
    assert page.evaluate('notificationCalls[2].cancel.notifications[0].id')==9001
    browser.close()
print('PASS: browser fallback, denied permission, inexact daily schedule and cancel; native delivery untested')
