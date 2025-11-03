// components/CaptainLottie.jsx
import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'

// Wichtig: kein SSR
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

export default function CaptainLottie({
    isLoading,
    className,
    width = 32,
    height = 32,
    src = '/lottie/OctahedronMorph.json',
}) {
    const [animationData, setAnimationData] = useState(null)
    const lottieRef = useRef(null)

    // JSON laden (Client)
    useEffect(() => {
        let alive = true
        fetch(src)
            .then((res) => res.json())
            .then((data) => { if (alive) setAnimationData(data) })
            .catch(console.error)
        return () => { alive = false }
    }, [src])

    // Beim Wechsel auf "nicht laden": Frame 0 anzeigen (Standbild)
    useEffect(() => {
        const inst = lottieRef.current
        if (!inst || !animationData) return
        if (!isLoading) {
            inst.goToAndStop(0, true)
        }
    }, [isLoading, animationData])

    if (!animationData) return null

    return (
        <div className={className} style={{ width, height }}>
            <Lottie
                key={isLoading ? 'play' : 'stop'}  // erzwingt Remount bei Wechsel
                lottieRef={lottieRef}
                animationData={animationData}
                loop={isLoading}
                autoplay={isLoading}
                style={{ width: '100%', height: '100%' }}
                rendererSettings={{
                    preserveAspectRatio: 'xMidYMid meet',
                }}
            />
        </div>
    )
}
