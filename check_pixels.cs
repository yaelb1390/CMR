using System;
using System.Drawing;

class Program {
    static void Main() {
        string inputPath = @"c:\Users\YAEL\Desktop\CRM PRESTMOS NUEVO\public\logo.png";
        using (Bitmap bmp = new Bitmap(inputPath)) {
            int h = bmp.Height;
            int w = bmp.Width;
            Console.WriteLine("Bottom-Left margin (10, h - 10): " + bmp.GetPixel(10, h - 10));
            Console.WriteLine("Bottom-Right margin (w - 10, h - 10): " + bmp.GetPixel(w - 10, h - 10));
            Console.WriteLine("Between lines (w/2, h - 15): " + bmp.GetPixel(w / 2, h - 15));
            Console.WriteLine("Below Icon, above text (w/2, (int)(h * 0.7)): " + bmp.GetPixel(w / 2, (int)(h * 0.7)));
        }
    }
}
