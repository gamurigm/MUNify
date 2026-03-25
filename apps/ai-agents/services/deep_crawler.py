# pyre-ignore-all-errors
"""
Servicio de scraping profundo con crawl4ai.
Convierte URLs en Markdown limpio para inyección directa al LLM.
"""
import asyncio
import logfire

try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
    CRAWL4AI_AVAILABLE = True
except ImportError:
    CRAWL4AI_AVAILABLE = False
    logfire.warning("crawl4ai no instalado. Usando trafilatura como fallback.")

# Fallback
try:
    import trafilatura
except ImportError:
    trafilatura = None


class DeepCrawler:
    """Singleton que envuelve AsyncWebCrawler de crawl4ai con fallback a trafilatura."""

    def __init__(self):
        self._browser_config = None
        self._run_config = None
        if CRAWL4AI_AVAILABLE:
            self._browser_config = BrowserConfig(
                headless=True,
                verbose=False,
            )
            self._run_config = CrawlerRunConfig(
                word_count_threshold=50,
                exclude_external_links=True,
                remove_overlay_elements=True,
            )

    async def crawl_url(self, url: str) -> str:
        """Descarga una URL y retorna su contenido como Markdown limpio."""
        if CRAWL4AI_AVAILABLE:
            return await self._crawl4ai_single(url)
        return await self._trafilatura_fallback(url)

    async def crawl_many(self, urls: list) -> list:
        """Crawl paralelo de múltiples URLs. Retorna lista de Markdown."""
        if CRAWL4AI_AVAILABLE:
            return await self._crawl4ai_many(urls)
        # Fallback secuencial con trafilatura
        results = []
        for url in urls:
            results.append(await self._trafilatura_fallback(url))
        return results

    # --- crawl4ai ---
    async def _crawl4ai_single(self, url: str) -> str:
        try:
            async with AsyncWebCrawler(config=self._browser_config) as crawler:
                result = await crawler.arun(url=url, config=self._run_config)
                if result.success and result.markdown:
                    logfire.info(f"[crawl4ai] OK: {url} ({len(result.markdown)} chars)")
                    return result.markdown[:8000]
                logfire.warning(f"[crawl4ai] Sin contenido: {url}")
                return ""
        except Exception as e:
            logfire.error(f"[crawl4ai] Error en {url}: {e}")
            return await self._trafilatura_fallback(url)

    async def _crawl4ai_many(self, urls: list) -> list:
        try:
            async with AsyncWebCrawler(config=self._browser_config) as crawler:
                results = await crawler.arun_many(urls=urls, config=self._run_config)
                output = []
                for r in results:
                    if r.success and r.markdown:
                        output.append(r.markdown[:8000])
                    else:
                        output.append("")
                return output
        except Exception as e:
            logfire.error(f"[crawl4ai] Error batch: {e}")
            return [await self._trafilatura_fallback(u) for u in urls]

    # --- trafilatura fallback ---
    async def _trafilatura_fallback(self, url: str) -> str:
        if not trafilatura:
            return ""
        try:
            downloaded = await asyncio.to_thread(trafilatura.fetch_url, url)
            content = await asyncio.to_thread(
                trafilatura.extract, downloaded,
                include_comments=False, include_tables=True
            )
            if content:
                logfire.info(f"[trafilatura] OK: {url} ({len(content)} chars)")
                return content[:8000]
            return ""
        except Exception as e:
            logfire.error(f"[trafilatura] Error en {url}: {e}")
            return ""


# Singleton
crawler = DeepCrawler()
