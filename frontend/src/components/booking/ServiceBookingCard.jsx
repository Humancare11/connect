import BookingCard from "./BookingCard";

// `priceInfo` comes from useServicePrice: the price in the visitor's currency, a skeleton while loading.
function ServiceBookingCard({ priceInfo, name, slug }) {
    const href = `/service-consultant?service=${slug || encodeURIComponent(name)}`;
    return <BookingCard priceInfo={priceInfo} ctaHref={href} />;
}

export default ServiceBookingCard;