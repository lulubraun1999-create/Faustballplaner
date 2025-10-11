
'use client';

import { Header } from '@/components/header';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

export default function ProfileSettingsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
          <aside>
            <Card>
              <CardHeader>
                <CardTitle>Menü</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="ghost" className="justify-start">Daten ändern</Button>
                <Button variant="ghost" className="justify-start">Passwort ändern</Button>
                <Button variant="ghost" className="justify-start">Logout</Button>
              </CardContent>
            </Card>
            <Card className="mt-8 border-destructive">
                <CardHeader>
                    <CardTitle>Konto löschen</CardTitle>
                    <CardDescription>
                        Achtung: Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" className="w-full">Konto dauerhaft löschen</Button>
                </CardContent>
            </Card>
          </aside>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Daten ändern</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="vorname">Vorname</Label>
                    <Input id="vorname" defaultValue="Lukas" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nachname">Nachname</Label>
                    <Input id="nachname" defaultValue="Braun" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                    <Label htmlFor="telefon">Telefon</Label>
                    <Input id="telefon" defaultValue="01734126996" />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="wohnort">Wohnort</Label>
                    <Input id="wohnort" defaultValue="Düsseldorf" />
                  </div>
                </div>
                <div className="space-y-2">
                    <Label>Position</Label>
                    <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <Checkbox id="abwehr" defaultChecked/>
                            <Label htmlFor="abwehr">Abwehr</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="zuspiel" defaultChecked />
                            <Label htmlFor="zuspiel">Zuspiel</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="angriff" defaultChecked/>
                            <Label htmlFor="angriff">Angriff</Label>
                        </div>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="geschlecht">Geschlecht</Label>
                        <Select defaultValue="mann">
                            <SelectTrigger id="geschlecht">
                                <SelectValue placeholder="Geschlecht wählen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="mann">Mann</SelectItem>
                                <SelectItem value="frau">Frau</SelectItem>
                                <SelectItem value="divers">Divers</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="geburtstag">Geburtstag</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !Date && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                <span>19. 01. 1999</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={new Date('1999-01-19')}
                                disabled
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="rolle">Rolle</Label>
                        <Input id="rolle" defaultValue="Spieler" disabled />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">E-Mail</Label>
                        <Input id="email" defaultValue="lulubraun1999@gmail.com" disabled />
                    </div>
                 </div>
                 <div>
                    <Button>Speichern</Button>
                 </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
