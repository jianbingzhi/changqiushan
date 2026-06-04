import { request } from './client'
import type { PublicActivity } from './types'

export function listActivities() {
  return request<PublicActivity[]>('/activities')
}

export function getActivity(id: string) {
  return request<PublicActivity>(`/activities/${id}`)
}

export function signupActivity(id: string, input: { userName: string; idCard: string; phone: string }) {
  return request<{ id: string }>(`/activities/${id}/signup`, {
    method: 'POST',
    auth: true,
    data: input,
  })
}

export interface JsapiPayParams {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
}

// 付费活动:对已建报名单发起 JSAPI 下单,返回 requestPayment 参数
export function paySignup(signupId: string) {
  return request<JsapiPayParams>(`/activities/signups/${signupId}/pay`, {
    method: 'POST',
    auth: true,
  })
}
