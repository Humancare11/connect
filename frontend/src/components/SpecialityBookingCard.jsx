import BookingCard from "./booking/BookingCard";

function SpecialityBookingCard({ price, priceLoading, categoryId, name, isPcp = false }) {
    const href = `/category-consultant?category=${categoryId}&specialty=${encodeURIComponent(name)}${isPcp ? "&pcp=1" : ""}`;
    return <BookingCard price={price} priceLoading={priceLoading} ctaHref={href} />;
}

export default SpecialityBookingCard;