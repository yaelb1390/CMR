using System;
using System.Drawing;
using System.Drawing.Imaging;

class Program {
    static void Main() {
        string inputPath = @"c:\Users\YAEL\Desktop\CRM PRESTMOS NUEVO\public\logo.png";
        string lightPath = @"c:\Users\YAEL\Desktop\CRM PRESTMOS NUEVO\public\logo_light.png";

        using (Bitmap bmp = new Bitmap(inputPath)) {
            int width = bmp.Width;
            int height = bmp.Height;

            Bitmap bmpLight = new Bitmap(width, height);
            int textBoundaryY = (int)(height * 0.53); // text starts below 53% of the image height

            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    Color color = bmp.GetPixel(x, y);

                    if (color.A == 0) {
                        // Keep transparent pixels transparent
                        bmpLight.SetPixel(x, y, Color.Transparent);
                    } else {
                        if (y >= textBoundaryY) {
                            // Convert dark blue and light blue text pixels to white.
                            // The text pixels have a low Red component compared to white/light grey.
                            if (color.R < 180) {
                                // Convert to white, preserving the original alpha (transparency edge antialiasing)
                                bmpLight.SetPixel(x, y, Color.FromArgb(color.A, 255, 255, 255));
                            } else {
                                // Keep original color (e.g. the white stem of the 'P' or white/grey pixels)
                                bmpLight.SetPixel(x, y, color);
                            }
                        } else {
                            // Keep original color for the icon area
                            bmpLight.SetPixel(x, y, color);
                        }
                    }
                }
            }

            bmpLight.Save(lightPath, ImageFormat.Png);
            bmpLight.Dispose();
        }

        Console.WriteLine("C# Light Logo Process Success!");
    }
}
