import { useState } from "react";
import "./Blogs.css";

const blogs = [
  {
    id: 1,
    title: "Understanding Preventive Healthcare in 2025",
    description:
      "Discover how routine screenings and lifestyle adjustments can dramatically reduce the risk of chronic illnesses before they develop.",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80",
    category: "Preventive Care",
  },
  {
    id: 2,
    title: "The Science Behind a Heart-Healthy Diet",
    description:
      "Cardiologists break down the foods, habits, and nutrients that keep your cardiovascular system performing at its best for decades.",
    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80",
    category: "Nutrition",
  },
  {
    id: 3,
    title: "Mental Health at Work: Breaking the Stigma",
    description:
      "Workplace stress and burnout are at record highs. Learn evidence-based strategies to protect your mental wellbeing on the job.",
    image: "https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=600&q=80",
    category: "Mental Health",
  },
  {
    id: 4,
    title: "Children's Vaccinations: What Every Parent Should Know",
    description:
      "A comprehensive guide to the immunisation schedule, addressing common concerns and helping parents make informed decisions.",
    image: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=600&q=80",
    category: "Paediatrics",
  },
  {
    id: 5,
    title: "Diabetes Management: New Approaches for 2025",
    description:
      "From continuous glucose monitors to Personalized nutrition plans, explore the latest tools helping diabetics live fuller lives.",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&q=80",
    category: "Chronic Care",
  },
  {
    id: 6,
    title: "Sleep Hygiene: The Forgotten Pillar of Good Health",
    description:
      "Quality sleep is as crucial as diet and exercise. Experts share practical steps to fix your sleep cycle and wake up restored.",
    image: "https://images.unsplash.com/photo-1541480601022-2308c0f02487?w=600&q=80",
    category: "Wellness",
  },
  {
    id: 7,
    title: "Gut Health and Immunity: What Research Reveals",
    description:
      "The gut-brain axis is reshaping how doctors treat everything from anxiety to autoimmune conditions. Here is what you need to know.",
    image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600&q=80",
    category: "Nutrition",
  },
  {
    id: 8,
    title: "Telehealth in India: A New Era of Patient Care",
    description:
      "How digital consultations are closing the healthcare access gap across tier-2 and tier-3 cities, saving time and improving outcomes.",
    image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&q=80",
    category: "Digital Health",
  },
  {
    id: 9,
    title: "Managing Hypertension Naturally",
    description:
      "Beyond medication — lifestyle, mindfulness, and dietary changes that can help bring blood pressure under control sustainably.",
    image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80",
    category: "Chronic Care",
  },
];

const CARDS_PER_PAGE = 6;

const categoryColors = {
  "Preventive Care": { bg: "#E6F5F3", text: "#0C8B7A" },
  Nutrition: { bg: "#FEF3E2", text: "#C97B1A" },
  "Mental Health": { bg: "#EEF2FF", text: "#4F46E5" },
  Paediatrics: { bg: "#FFF0F6", text: "#C2185B" },
  "Chronic Care": { bg: "#F0FDF4", text: "#16A34A" },
  Wellness: { bg: "#F0F9FF", text: "#0284C7" },
  "Digital Health": { bg: "#F5F3FF", text: "#7C3AED" },
};

export default function BlogPage() {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(blogs.length / CARDS_PER_PAGE);
  const start = (currentPage - 1) * CARDS_PER_PAGE;
  const visibleBlogs = blogs.slice(start, start + CARDS_PER_PAGE);

  const goTo = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    document.getElementById("blog-grid").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="blog-page">
      <section>
        <div className="blog-hero">
  <div className="blog-hero-inner">
    <h1>Health & Medical Blogs</h1>
    <p>
      Stay informed with expert insights, health tips, and the latest medical
      updates — curated by professionals you can trust.
    </p>
  </div>
</div>
      </section>

      <section className="blog-grid-section" id="blog-grid">
        <div className="section-header">
          <h2 className="section-title">Latest Articles</h2>
          <p className="section-sub">Stay informed with our most recent health guides</p>
        </div>

        <div className="blog-grid">
          {visibleBlogs.map((blog) => {
            const color = categoryColors[blog.category] || { bg: "#F4F7FB", text: "#223A5E" };
            return (
              <article className="blog-card" key={blog.id}>
                <div className="card-img-wrap">
                  <img src={blog.image} alt={blog.title} className="card-img" loading="lazy" />
                  <span
                    className="card-category"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {blog.category}
                  </span>
                </div>
                <div className="card-body">
                  <h3 className="card-title">{blog.title}</h3>
                  <p className="card-desc">{blog.description}</p>
                  <button className="card-btn">
                    Read More
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="pagination">
          <button
            className="page-btn nav-btn"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`page-btn num-btn${currentPage === page ? " active" : ""}`}
              onClick={() => goTo(page)}
            >
              {page}
            </button>
          ))}

          <button
            className="page-btn nav-btn"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}