Imports System
Imports Microsoft.AspNetCore.Builder
Imports Microsoft.Extensions.Hosting
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.AspNetCore.Hosting

Module Program
    Sub Main(args As String())
        Dim builder As WebApplicationBuilder = WebApplication.CreateBuilder(args)

        ' Read "Port" from appsettings.json, environment variable, or command-line argument (--Port=<port>)
        Dim portStr As String = builder.Configuration("Port")
        Dim port As Integer
        If Not Integer.TryParse(portStr, port) Then
            port = 5123 ' Default port fallback
        End If

        builder.WebHost.UseUrls($"http://localhost:{port}")

        ' Add services to the container
        builder.Services.AddControllers()

        Dim app As WebApplication = builder.Build()

        ' Enable static files serving (wwwroot)
        app.UseDefaultFiles()
        app.UseStaticFiles()

        app.UseRouting()
        app.MapControllers()

        Console.WriteLine("==================================================")
        Console.WriteLine(" SimpleVG - SCADA SVG Editor (VB.NET 10 Core Server)")
        Console.WriteLine($" Listening on http://localhost:{port}")
        Console.WriteLine("==================================================")

        app.Run()
    End Sub
End Module
