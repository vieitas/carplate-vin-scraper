namespace CarPlateVinScraper.Models
{
    public class VinResponse
    {
        public bool Success { get; set; }
        public string? Vin { get; set; }
        public string? Plate { get; set; }
        public string? State { get; set; }
        public string? Source { get; set; }
        public string? Error { get; set; }
        public DebugInfo? Debug { get; set; }
    }

    public class DebugInfo
    {
        public string? Url { get; set; }
        public string? Title { get; set; }
        public string? Preview { get; set; }
    }
}

