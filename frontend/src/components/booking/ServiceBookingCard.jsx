import BookingCard from "./BookingCard";

function ServiceBookingCard({ price, priceLoading, name, slug }) {
    const href = `/service-consultant?service=${slug || encodeURIComponent(name)}`;
    return <BookingCard price={price} priceLoading={priceLoading} ctaHref={href} />;
}

export default ServiceBookingCard;