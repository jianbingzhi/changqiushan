import { View, Text, Map } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { listPoi, listParking } from '@/api/map'
import { usePolling } from '@/hooks/usePolling'
import type { PublicPoi, PublicParkingLot } from '@/api/types'
import './index.scss'

// 长秋山森林公园大致中心(四川蒲江),无定位权限时的默认视野
const PARK_CENTER = { latitude: 30.1972, longitude: 103.5067 }

const CATEGORIES = ['全部', '景点', '观景台', '餐饮', '停车场', '卫生间', '补给站', '应急医疗']
const PARK_DOT: Record<string, string> = { OPEN: '#059669', FULL: '#DC2626', CLOSED: '#9CA3AF' }
const PARK_TEXT: Record<string, string> = { OPEN: '空余', FULL: '已满', CLOSED: '关闭' }

export default function GuideMap() {
  const [pois, setPois] = useState<PublicPoi[]>([])
  const [parking, setParking] = useState<PublicParkingLot[]>([])
  const [category, setCategory] = useState('全部')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [is3D, setIs3D] = useState(false)

  useLoad(async () => {
    const r = await listPoi()
    if (r.ok) setPois(r.data)
  })

  // 停车抽屉打开时才 30s 轮询(关闭/onHide 自动停)
  const loadParking = useCallback(async () => {
    const r = await listParking()
    if (r.ok) setParking(r.data)
  }, [])
  usePolling(loadParking, 30000, drawerOpen)

  const filtered = useMemo(
    () => (category === '全部' ? pois : pois.filter((p) => p.category === category)),
    [pois, category],
  )

  const markers = filtered.map((p, i) => ({
    id: i + 1,
    latitude: p.latitude,
    longitude: p.longitude,
    title: p.name,
    width: 28,
    height: 28,
    callout: { content: p.name, display: 'BYCLICK' as const, padding: 8, borderRadius: 8 },
  }))

  const navigateTo = (lot: PublicParkingLot) => {
    Taro.openLocation({
      latitude: PARK_CENTER.latitude,
      longitude: PARK_CENTER.longitude,
      name: lot.name,
      scale: 16,
    }).catch(() => Taro.showToast({ title: '无法打开导航', icon: 'none' }))
  }

  return (
    <View className='gmap'>
      <Map
        className='gmap__canvas'
        latitude={PARK_CENTER.latitude}
        longitude={PARK_CENTER.longitude}
        scale={14}
        markers={markers}
        showLocation
        enable3D={is3D}
      />

      <View className='gmap__chips'>
        {CATEGORIES.map((c) => (
          <Text
            key={c}
            className={`gmap__chip ${category === c ? 'gmap__chip--active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </Text>
        ))}
      </View>

      <View className='gmap__controls'>
        <View className='gmap__ctrl' onClick={() => setIs3D((v) => !v)}>{is3D ? '切为2D' : '切为3D'}</View>
        <View className='gmap__ctrl' onClick={() => setDrawerOpen((v) => !v)}>🅿️</View>
      </View>

      {drawerOpen ? (
        <View className='gmap__drawer'>
          <View className='gmap__drawer-head'>
            <Text className='gmap__drawer-title'>停车场实时余量</Text>
            <Text className='gmap__drawer-hint'>每 30 秒更新</Text>
          </View>
          {parking.length > 0 ? (
            parking.map((lot) => (
              <View key={lot.id} className='gmap__lot'>
                <View className='gmap__lot-dot' style={{ background: PARK_DOT[lot.status] }} />
                <View className='gmap__lot-info'>
                  <Text className='gmap__lot-name'>{lot.name}</Text>
                  <Text className='gmap__lot-sub'>
                    {PARK_TEXT[lot.status]} · 余 {lot.available} / {lot.capacity}
                  </Text>
                </View>
                <Text className='gmap__lot-nav' onClick={() => navigateTo(lot)}>导航前往</Text>
              </View>
            ))
          ) : (
            <Text className='gmap__lot-empty'>暂无停车场数据</Text>
          )}
        </View>
      ) : null}
    </View>
  )
}
