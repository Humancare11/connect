import { useEffect, useState } from "react";
import api from "../api";

export function useServicePrice(slug) {
    const [price, setPrice] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        if (!slug) { setLoading(false); return; }
        setLoading(true);
        api.get(`/api/services/by-slug/${slug}`)
            .then((res) => { if (!cancelled) setPrice(res.data?.price ?? null); })
            .catch(() => { if (!cancelled) setPrice(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [slug]);

    return { price: loading ? null : (price || 49), priceLoading: loading };
}