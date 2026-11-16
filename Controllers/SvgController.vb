Imports Microsoft.AspNetCore.Mvc
Imports System.Text
Imports System.Xml.Linq

Namespace Controllers

    <ApiController>
    <Route("api/[controller]")>
    Public Class SvgController
        Inherits ControllerBase

        Public Class SvgCleanRequest
            Public Property XmlContent As String
        End Class

        ''' <summary>
        ''' Formats and cleans SVG XML string
        ''' </summary>
        <HttpPost("clean")>
        Public Function CleanSvg(<FromBody> req As SvgCleanRequest) As IActionResult
            If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.XmlContent) Then
                Return BadRequest(New With {Key .Success = False, Key .Message = "No XML provided."})
            End If

            Try
                Dim doc As XDocument = XDocument.Parse(req.XmlContent)
                Dim formattedXml As String = doc.ToString()

                Return Ok(New With {
                    Key .Success = True,
                    Key .FormattedXml = formattedXml
                })
            Catch ex As Exception
                Return BadRequest(New With {
                    Key .Success = False,
                    Key .Message = "Invalid SVG XML: " & ex.Message
                })
            End Try
        End Function

        ''' <summary>
        ''' Server endpoint to echo downloadable SVG file with clean header
        ''' </summary>
        <HttpPost("download")>
        Public Function DownloadSvg(<FromForm> svgContent As String, <FromForm> filename As String) As IActionResult
            If String.IsNullOrWhiteSpace(filename) Then
                filename = "scada_symbol.svg"
            End If
            If Not filename.EndsWith(".svg", StringComparison.OrdinalIgnoreCase) Then
                filename &= ".svg"
            End If

            Dim bytes As Byte() = Encoding.UTF8.GetBytes(If(svgContent, ""))
            Return File(bytes, "image/svg+xml", filename)
        End Function

    End Class

End Namespace
